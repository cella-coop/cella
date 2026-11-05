// The feat check's foreign writes: a feat's or a graft's SQL and
// TypeScript write and trigger only on its own schema's tables (and
// register in cella.*); any other write its migrations leave standing is
// refused, with no list of exceptions to name it.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { checkSql } from '../sql-check.mjs'
import { refuse, scanTs } from '../writes.mjs'

// A throwaway tree with three feats and the SQL files given for each
// owner, a graft by its hyphenated name; each file is `NNN.sql`. Answers
// the check's errors and what it found.
async function check(sql) {
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
    return { errors, found }
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
}

// The foreign writes a tree's SQL leaves standing, its check otherwise clean.
async function foreign(sql) {
  const { errors, found } = await check(sql)
  assert.deepEqual(errors, [])
  return found.foreign.map((f) => `${f.owner}: ${f.what}`)
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

test('a slice\'s TypeScript that writes another\'s table is found, its own and its tests not', async () => {
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
    assert.deepEqual((await scanTs(repo, dir, 'payslip-timesheet', 'payslip_timesheet')).map((f) => f.what), [
      'src/handlers/generate.ts writes payslip.payslip',
      'src/handlers/generate.ts writes timesheet.entry',
    ])
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

const verbs = {
  insert: (table) => `INSERT INTO ${table} (id) VALUES ($1)`,
  update: (table) => `UPDATE ${table} SET id = $1`,
  delete: (table) => `DELETE FROM ${table} WHERE id = $1`,
  merge: (table) => `MERGE INTO ${table} AS t USING (SELECT $1 AS id) AS s ON t.id = s.id WHEN MATCHED THEN DELETE`,
  truncate: (table) => `TRUNCATE TABLE ${table}`,
  trigger: (table) => `CREATE TRIGGER changed AFTER INSERT ON ${table} FOR EACH ROW EXECUTE FUNCTION own.changed()`,
}

// All six kinds of target must resolve through Postgres's rules for
// unquoted lowercase, quoted names and mixed-case SQL keywords/names.
for (const [verb, statement] of Object.entries(verbs)) {
  for (const [spelling, table, format] of [
    ['lowercase', 'transaction.line', (s) => s.toLowerCase()],
    ['quoted', '"transaction"."line"', (s) => s],
    ['mixed', 'TrAnSaCtIoN.LiNe', (s) => s.replace(/\b(insert|into|update|delete|from|merge|using|truncate|table|create|trigger|after|on|for|each|row|execute|function)\b/gi, (w) => w[0].toLowerCase() + w.slice(1).toUpperCase())],
  ]) {
    test(`${verb} with ${spelling} names a foreign table`, async () => {
      const repo = mkdtempSync(join(tmpdir(), 'cella-writes-ts-'))
      try {
        const dir = 'apps/org/grafts/own-other/ts'
        const src = join(repo, dir, 'src')
        mkdirSync(src, { recursive: true })
        const own = spelling === 'quoted' ? '"own_other"."line"' : 'own_other.line'
        const notary = spelling === 'quoted' ? '"cella"."guard"' : 'cella.guard'
        writeFileSync(join(src, 'handler.ts'), [table, own, notary].map((target) =>
          `await tx.query(\`${format(statement(target))}\`)`,
        ).join('\n'))
        assert.deepEqual((await scanTs(repo, dir, 'own-other', 'own_other')).map((f) => f.what), [
          `src/handler.ts ${verb === 'trigger' ? 'triggers on' : 'writes'} transaction.line`,
        ])
      } finally {
        rmSync(repo, { recursive: true, force: true })
      }
    })
  }
}

test('literals, interpolation, CTEs, comments and own tables', async () => {
  const repo = mkdtempSync(join(tmpdir(), 'cella-writes-ts-'))
  try {
    const dir = 'apps/org/grafts/own-other/ts'
    const src = join(repo, dir, 'src')
    mkdirSync(src, { recursive: true })
    writeFileSync(join(src, 'handler.ts'), [
      'const sql = `WITH changed AS (DELETE FROM "transaction"."line" WHERE id = ${id} RETURNING id) SELECT * FROM changed`',
      'const other = "UPDATE transaction.line SET id = 1"',
      'const ok = `INSERT INTO "own_other"."line" VALUES (1); DELETE FROM cella.guard WHERE id = 1`',
      '// `UPDATE transaction.line SET id = 1`',
      'const prose = "Please UPDATE transaction.line for the report"',
      'const dynamic = `UPDATE ${schema}.line SET id = 1`',
      'const commented = `-- UPDATE transaction.line SET id = 1\nSELECT 1`',
    ].join('\n'))
    assert.deepEqual((await scanTs(repo, dir, 'own-other', 'own_other')).map((f) => f.what), [
      'src/handler.ts writes transaction.line',
      'src/handler.ts writes transaction.line',
    ])
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

test('a graft\'s trigger on a feat\'s table and its insert into one are refused, with no list to name them', async () => {
  const { errors, found } = await check({
    'invoice-member': [`${table}
CREATE TRIGGER whose BEFORE INSERT ON invoice.invoice FOR EACH ROW EXECUTE FUNCTION invoice_member.whose();
INSERT INTO invoice.line (invoice, cents) VALUES (NULL, 100);`],
  })
  assert.deepEqual(errors, [])
  assert.deepEqual(refuse(found.foreign), [
    'apps/org/grafts/invoice-member/sql/001.sql: invoice-member trigger whose on invoice.invoice, a table it does not own: a slice writes only its own schema, and changes a feat only by calling that feat\'s published write',
    'apps/org/grafts/invoice-member/sql/001.sql: invoice-member 001.sql writes invoice.line, a table it does not own: a slice writes only its own schema, and changes a feat only by calling that feat\'s published write',
  ])
  assert.deepEqual(refuse([]), [])
})

test('a graft registers with the motion feat through its register functions, and an insert into the register is a foreign write', async () => {
  const { errors, found } = await check({
    'member-motion': [`SELECT motion.register_carries('admit', 'Admit a member', '[{"name": "member", "label": "Address", "type": "text"}]', 'member:member:admit', 'member-motion');
SELECT motion.register_cite('member:member:admit', 'admit-member', 'member-motion');
SELECT motion.register_cite_guard('member_motion.carried(jsonb)', 'member-motion');`],
  })
  assert.deepEqual(errors, [])
  assert.deepEqual(found.foreign, [])
  assert.deepEqual(found.cites, [{ op: 'member:member:admit', power: 'admit-member', owner: 'member-motion' }])

  const inserted = await foreign({
    'member-motion': [`INSERT INTO motion.carries (kind, label, fields, owner) VALUES ('admit', 'Admit a member', '[]', 'member-motion');
INSERT INTO motion.cites (op, owner) VALUES ('member:member:admit', 'member-motion');`],
  })
  assert.deepEqual(inserted, ['member-motion: 001.sql writes motion.carries', 'member-motion: 001.sql writes motion.cites'])
  const refused = refuse(inserted.map((what) => ({ owner: 'member-motion', what: what.split(': ')[1], path: 'apps/org/grafts/member-motion/sql/001.sql' })))
  assert.equal(refused.length, 2)
  assert.match(refused[0], /member-motion 001.sql writes motion.carries, a table it does not own/)
})

test('a register call under another\'s name, or with an argument the check cannot read, is refused', async () => {
  const { errors } = await check({
    'member-motion': [`SELECT motion.register_cite('member:member:admit', 'admit-member', 'invoice-member');
SELECT motion.register_cite(lower('member:member:exit'), 'end-membership', 'member-motion');`],
  })
  assert.deepEqual(errors, [
    'apps/org/grafts/member-motion/sql/001.sql: registers by motion.register_cite as invoice-member, not as itself, member-motion',
    'apps/org/grafts/member-motion/sql/001.sql: calls motion.register_cite with an argument that is no literal string, which the check cannot see',
  ])
})
