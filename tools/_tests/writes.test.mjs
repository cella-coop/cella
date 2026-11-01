// The feat check's foreign writes: a feat's or a graft's SQL and
// TypeScript write and trigger only on its own schema's tables (and
// register in cella.*); any other write its migrations leave standing is
// refused unless the app's foreign.list names it, and a listed write that
// is gone is refused too.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { checkSql } from '../sql-check.mjs'
import { ratchet, scanTs } from '../writes.mjs'

// A throwaway tree with three feats and the SQL files given for each
// owner, a graft by its hyphenated name; each file is `NNN.sql`.
async function foreign(sql) {
  const repo = mkdtempSync(join(tmpdir(), 'cella-writes-'))
  try {
    for (const feat of ['motion', 'invoice', 'member']) {
      mkdirSync(join(repo, 'apps/org/feats', feat, 'core/sql'), { recursive: true })
      writeFileSync(join(repo, 'apps/org/feats', feat, 'feat.toml'), `name = "${feat}"\n`)
    }
    writeFileSync(join(repo, 'apps/org/feat.toml'), 'name = "org"\n')
    for (const [owner, files] of Object.entries(sql)) {
      const dir = owner.includes('-') ? join('apps/org/grafts', owner, 'sql') : join('apps/org/feats', owner, 'core/sql')
      mkdirSync(join(repo, dir), { recursive: true })
      files.forEach((text, i) => writeFileSync(join(repo, dir, `00${i + 1}.sql`), text))
    }
    const found = { powers: [], guards: [], cites: [], personal: [], impersonal: [], columns: [], foreign: [] }
    const known = new Set(['cella', 'motion', 'invoice', 'member', 'invoice_member', 'member_motion'])
    const errors = await checkSql(repo, ['apps/org'], known, found)
    assert.deepEqual(errors, [])
    return found.foreign.map((f) => `${f.owner}: ${f.what}`)
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
}

const table = 'CREATE TABLE invoice_member.link (invoice uuid, member text);'

test('a graft writes and triggers on its own tables and registers in cella.*', async () => {
  assert.deepEqual(await foreign({
    'invoice-member': [`${table}
CREATE FUNCTION invoice_member.links() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO invoice_member.link (invoice, member) VALUES (NEW.invoice, NEW.member);
  RETURN NEW;
END $$;
CREATE TRIGGER links AFTER INSERT ON invoice_member.link FOR EACH ROW EXECUTE FUNCTION invoice_member.links();
INSERT INTO cella.guard (op, fn, owner) VALUES ('invoice:invoice:issue', 'invoice_member.linked(jsonb)', 'invoice-member');`],
  }), [])
})

test('a graft that writes a feat\'s table, in a function, a CTE or the migration itself, is found', async () => {
  assert.deepEqual(await foreign({
    'invoice-member': [`${table}
CREATE FUNCTION invoice_member.pays() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE invoice.invoice SET paid = true WHERE id = NEW.invoice;
  RETURN NEW;
END $$;
CREATE FUNCTION invoice_member.voids(id uuid) RETURNS void LANGUAGE sql AS $$
  WITH gone AS (DELETE FROM member.member WHERE address = 'x' RETURNING address) SELECT 1
$$;
INSERT INTO member.kind (kind, owner) VALUES ('link', 'invoice-member');`],
  }), [
    'invoice-member: invoice_member.pays() writes invoice.invoice',
    'invoice-member: invoice_member.voids() writes member.member',
    'invoice-member: 001.sql writes member.kind',
  ])
})

test('a trigger on a feat\'s table or a lower-order graft\'s is found', async () => {
  assert.deepEqual(await foreign({
    'invoice-member': [`${table}
CREATE TRIGGER whose BEFORE INSERT ON invoice.invoice FOR EACH ROW EXECUTE FUNCTION invoice_member.whose();`],
    'invoice-member-motion': ['CREATE TRIGGER links AFTER INSERT ON invoice_member.link FOR EACH ROW EXECUTE FUNCTION invoice_member_motion.f();'],
    member: ['TRUNCATE member.member;'],
  }), [
    'invoice-member: trigger whose on invoice.invoice',
    'invoice-member-motion: trigger links on invoice_member.link',
  ])
})

test('a later migration that drops the trigger, or drops or replaces the function, takes the write away', async () => {
  const pays = `CREATE FUNCTION invoice_member.pays() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE invoice.invoice SET paid = true WHERE id = NEW.invoice;
  RETURN NEW;
END $$;
CREATE TRIGGER pays AFTER INSERT ON invoice.payment FOR EACH ROW EXECUTE FUNCTION invoice_member.pays();`
  assert.deepEqual(await foreign({ 'invoice-member': [pays, 'DROP TRIGGER pays ON invoice.payment;\nDROP FUNCTION invoice_member.pays();'] }), [])
  assert.deepEqual(await foreign({
    'invoice-member': [pays, `DROP TRIGGER pays ON invoice.payment;
CREATE OR REPLACE FUNCTION invoice_member.pays() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RETURN NEW;
END $$;`],
  }), [])
  assert.deepEqual(await foreign({ 'invoice-member': [pays, 'DROP FUNCTION invoice_member.pays() CASCADE;'] }), ['invoice-member: trigger pays on invoice.payment'])
})

test('a slice\'s TypeScript that writes another\'s table is found, its own and its tests not', () => {
  const repo = mkdtempSync(join(tmpdir(), 'cella-writes-ts-'))
  try {
    const dir = 'apps/org/grafts/payslip-timesheet/ts'
    mkdirSync(join(repo, dir, 'src/handlers'), { recursive: true })
    mkdirSync(join(repo, dir, 'src/_tests'), { recursive: true })
    writeFileSync(join(repo, dir, 'src/handlers/generate.ts'), [
      'await tx.query(`WITH t AS (UPDATE payslip.payslip SET minutes = 1 RETURNING minutes) SELECT 1`)',
      'await tx.query(`INSERT INTO payslip_timesheet.timed (payslip) VALUES ($1)`)',
      'await tx.query(`DELETE FROM timesheet.entry WHERE id = $1`)',
      '// update payslip.payslip in prose is no write',
    ].join('\n'))
    writeFileSync(join(repo, dir, 'src/_tests/seed.ts'), 'await tx.query(`INSERT INTO payslip.payslip VALUES (1)`)')
    assert.deepEqual(scanTs(repo, dir, 'payslip-timesheet', 'payslip_timesheet').map((f) => f.what), [
      'src/handlers/generate.ts writes payslip.payslip',
      'src/handlers/generate.ts writes timesheet.entry',
    ])
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

test('a foreign write the list does not name is refused, and so is a listed one that is gone', () => {
  const found = [{ owner: 'invoice-member', what: 'trigger whose on invoice.invoice', path: 'apps/org/grafts/invoice-member/sql/001.sql' }]
  assert.deepEqual(ratchet(found, ['invoice-member: trigger whose on invoice.invoice'], 'apps/org'), [])
  assert.match(ratchet(found, [], 'apps/org')[0], /^apps\/org\/grafts\/invoice-member\/sql\/001.sql: invoice-member trigger whose on invoice.invoice, a table it does not own: a slice writes only its own schema/)
  assert.deepEqual(ratchet([], ['invoice-member: trigger whose on invoice.invoice'], 'apps/org'), [
    'apps/org/foreign.list: invoice-member: trigger whose on invoice.invoice is gone: strike it from the list',
  ])
})
