// The feat check's power rules: what an action's label in actions.ts says it needs
// is what its feat registers in cella.power, and only the op's own feat
// registers it.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { agree, covered } from '../powers.mjs'
import { checkSql, undeclared } from '../sql-check.mjs'

const file = 'apps/org/feats/invoice/core/ts/src/models/actions.ts'
const op = (o, power = null, amount = null, check = null) => ({ op: o, power, amount, check, file })
const row = (o, power, amount = null, owner = 'invoice') => ({ op: o, power, amount, owner })

test('actions.ts and cella.power agree', () => {
  assert.deepEqual(agree([op('invoice:invoice:issue', 'issue-invoice'), op('invoice:invoice:send')], [row('invoice:invoice:issue', 'issue-invoice')]), [])
})

test('a power in actions.ts that no SQL registers is refused', () => {
  const [e] = agree([op('invoice:invoice:issue', 'issue-invoice')], [])
  assert.match(e, /invoice:invoice:issue needs issue-invoice, which no SQL registers in cella.power/)
})

test('a power or amount that differs is refused', () => {
  assert.match(agree([op('invoice:invoice:issue', 'issue-invoice')], [row('invoice:invoice:issue', 'pay-supplier')])[0], /but cella.power registers pay-supplier/)
  assert.match(
    agree([op('transaction:transaction:pay', 'pay-supplier', 'amount')], [row('transaction:transaction:pay', 'pay-supplier', null, 'transaction')])[0],
    /needs pay-supplier up to its amount, but cella.power registers pay-supplier$/,
  )
})

test('a registered power that actions.ts does not name, or registered twice, is refused', () => {
  assert.match(agree([op('invoice:invoice:send')], [row('invoice:invoice:send', 'issue-invoice')])[0], /which its label does not name/)
  assert.match(agree([], [row('invoice:invoice:lost', 'issue-invoice')])[0], /which no actions.ts declares/)
  const twice = agree([op('invoice:invoice:issue', 'issue-invoice')], [row('invoice:invoice:issue', 'issue-invoice'), row('invoice:invoice:issue', 'issue-invoice')])
  assert.match(twice[0], /registers a power on invoice:invoice:issue twice/)
})

// A throwaway tree with one app and four feats, each with one SQL file,
// and SQL for any graft named in `sql` by its hyphenated name.
async function check(sql) {
  const repo = mkdtempSync(join(tmpdir(), 'cella-sql-'))
  try {
    for (const feat of ['circle', 'decision', 'invoice', 'member']) {
      mkdirSync(join(repo, 'apps/org/feats', feat, 'core/sql'), { recursive: true })
      writeFileSync(join(repo, 'apps/org/feats', feat, 'feat.toml'), `name = "${feat}"\n`)
    }
    writeFileSync(join(repo, 'apps/org/feat.toml'), 'name = "org"\n')
    for (const [owner, text] of Object.entries(sql)) {
      const dir = owner.includes('-') ? join('apps/org/grafts', owner, 'sql') : join('apps/org/feats', owner, 'core/sql')
      mkdirSync(join(repo, dir), { recursive: true })
      writeFileSync(join(repo, dir, '001.sql'), text)
    }
    const found = { powers: [], guards: [], cites: [], personal: [], impersonal: [], columns: [] }
    const known = new Set(['cella', 'circle', 'invoice', 'member', 'decision', 'circle_member', 'circle_invoice_member', 'decision_member', 'invoice_member'])
    const errors = await checkSql(repo, ['apps/org'], known, found)
    return { errors, powers: found.powers, found }
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
}

test('a feat registers powers only on its own ops, as literal rows, under its own name', async () => {
  const own = await check({ invoice: `INSERT INTO cella.power (op, power, amount, owner) VALUES ('invoice:invoice:issue', 'issue-invoice', NULL, 'invoice');` })
  assert.deepEqual([own.errors, own.powers], [[], [row('invoice:invoice:issue', 'issue-invoice')]])

  const other = await check({ member: `INSERT INTO cella.power (op, power, amount, owner) VALUES ('invoice:invoice:issue', 'issue-invoice', NULL, 'member');` })
  assert.match(other.errors.join('\n'), /registers a power on invoice:invoice:issue, an op of invoice: only invoice names what its ops need/)

  const named = await check({ invoice: `INSERT INTO cella.power (op, power, amount, owner) VALUES ('invoice:invoice:issue', 'issue-invoice', NULL, 'member');` })
  assert.match(named.errors.join('\n'), /registers a power as member, not as itself, invoice/)

  const queried = await check({ invoice: `INSERT INTO cella.power (op, power, amount, owner) SELECT 'invoice:invoice:issue', 'issue-invoice', NULL, 'invoice';` })
  assert.match(queried.errors.join('\n'), /a power is a literal row/)
})

test('only a feat registers the keyring, and nothing else in cella is written', async () => {
  const keyring = await check({ member: `INSERT INTO cella.keyring (fn, owner) VALUES ('member.verifies(text, bytea)', 'member');` })
  assert.deepEqual(keyring.errors, [])
  const log = await check({ member: `INSERT INTO cella.receipt (n) VALUES (1);` })
  assert.match(log.errors.join('\n'), /writes cella.receipt: a feat writes cella.\* only to register its guards, its powers, its personal columns, the keyring or who reads/)
})

test('who reads a feat is registered by literal rows: its powers by the feat or a graft joining it, the authority and reaches by a graft', async () => {
  const reading = (what, owner) => `INSERT INTO cella.reading (what, key, power, owner) VALUES ('${what}', NULL, 'issue-invoice', '${owner}');`
  const own = await check({ invoice: reading('invoice', 'invoice'), 'invoice-member': reading('member', 'invoice-member') })
  assert.deepEqual(own.errors, [])
  const other = await check({ invoice: reading('member', 'invoice') })
  assert.match(other.errors.join('\n'), /registers who reads member: a feat says who reads only invoice/)
  const beside = await check({ 'circle-member': reading('invoice', 'circle-member') })
  assert.match(beside.errors.join('\n'), /registers who reads invoice: a graft says who reads only circle, member/)
  const queried = await check({ invoice: `INSERT INTO cella.reading (what, key, power, owner) SELECT 'invoice', NULL, 'issue-invoice', 'invoice';` })
  assert.match(queried.errors.join('\n'), /registers cella.reading from a query: each is a literal row/)

  const authority = `INSERT INTO cella.authority (fn, owner) VALUES ('circle_member.may(text, text, bigint, date)', 'circle-member');`
  assert.deepEqual((await check({ 'circle-member': authority })).errors, [])
  const byFeat = await check({ member: `INSERT INTO cella.authority (fn, owner) VALUES ('member.may(text, text, bigint, date)', 'member');` })
  assert.match(byFeat.errors.join('\n'), /registers cella.authority: only a graft opens a feat's rows to more readers, not feat member/)

  const reach = (what, owner) => `INSERT INTO cella.reach (what, fn, owner) VALUES ('${what}', 'invoice_member.reaches(text, text)', '${owner}');`
  assert.deepEqual((await check({ 'invoice-member': reach('invoice', 'invoice-member') })).errors, [])
  const notJoined = await check({ 'invoice-member': reach('circle', 'invoice-member') })
  assert.match(notJoined.errors.join('\n'), /registers who reads circle: a graft says who reads only invoice, member/)
  const reachByFeat = await check({ invoice: reach('invoice', 'invoice') })
  assert.match(reachByFeat.errors.join('\n'), /registers cella.reach: only a graft opens/)
})

test('a slice keeps row-level policies and alters functions only in its own schema', async () => {
  const own = await check({
    invoice: `CREATE POLICY reads ON invoice.invoice FOR SELECT TO cella_app USING ((SELECT cella.sees('invoice')));
      ALTER FUNCTION invoice.total(text) SECURITY DEFINER SET search_path = pg_catalog, pg_temp;`,
  })
  assert.deepEqual(own.errors, [])
  const other = await check({ 'invoice-member': `CREATE POLICY reads ON invoice.invoice FOR SELECT TO cella_app USING (true);` })
  assert.match(other.errors.join('\n'), /creates the policy reads on invoice.invoice: graft invoice-member creates and grants only in its own schema, invoice_member/)
  const altered = await check({ 'invoice-member': `ALTER FUNCTION invoice.total(text) SECURITY DEFINER;` })
  assert.match(altered.errors.join('\n'), /alters invoice.total: graft invoice-member creates and grants only in its own schema/)
  const path = await check({ invoice: `ALTER FUNCTION invoice.total(text) SET search_path = invoice;` })
  assert.match(path.errors.join('\n'), /invoice.total sets search_path beyond the catalog/)
})

test('a graft registers guards on ops of the feats it joins and of the lower-order grafts it builds on, and no others', async () => {
  const guard = (op, owner) => `INSERT INTO cella.guard (op, fn, owner) VALUES ('${op}', 'cella.action()', '${owner}');`
  const lower = await check({
    'circle-member': 'SELECT 1;',
    'circle-invoice-member': guard('circle-member:position:add', 'circle-invoice-member') + guard('member:member:admit', 'circle-invoice-member'),
  })
  assert.deepEqual(lower.errors, [])
  const beside = await check({ 'circle-member': guard('invoice-member:link:add', 'circle-member') })
  assert.match(beside.errors.join('\n'), /registers a guard on invoice-member:link:add, an op of invoice-member, which circle-member neither joins nor builds on/)
  const higher = await check({ 'circle-member': guard('circle-invoice-member:roll:fix', 'circle-member') })
  assert.match(higher.errors.join('\n'), /an op of circle-invoice-member, which circle-member neither joins nor builds on/)
})

test('an op with neither a power nor a check is refused: nothing is allowed by omission', () => {
  const none = covered([op('invoice:invoice:send')], { guards: [], cites: [] })
  assert.match(none[0], /invoice:invoice:send names neither a power nor a check: no action is allowed by omission/)
  assert.deepEqual(covered([op('invoice:invoice:issue', 'issue-invoice')], { guards: [], cites: [] }), [])
  const odd = covered([op('invoice:invoice:send', null, null, 'anyone')], { guards: [], cites: [] })
  assert.match(odd[0], /declares the check anyone, which is none of self, roll, seat, decided/)
})

test('a declared check is backed by SQL: a guard on the op, or for decided a row in decision.cites', () => {
  const self = op('member:member:profile', null, null, 'self')
  const decided = op('member:member:admit', null, null, 'decided')
  assert.match(covered([self], { guards: [], cites: [] })[0], /member:member:profile checks self, but no SQL registers a guard on it in cella.guard/)
  assert.match(covered([decided], { guards: [{ op: 'member:member:admit', owner: 'member' }], cites: [] })[0], /member:member:admit is decided, but no SQL lists it in decision.cites/)
  assert.deepEqual(covered([self, decided], {
    guards: [{ op: 'member:member:profile', owner: 'member' }],
    cites: [{ op: 'member:member:admit', owner: 'decision-member' }],
  }), [])
})

test('a column that may hold personal data is registered personal or commented not personal, in its own schema', async () => {
  const table = `CREATE TABLE member.member (address text PRIMARY KEY, name text NOT NULL, shares integer, email text);`
  const bare = await check({ member: table })
  assert.deepEqual(undeclared(bare.found), [
    'apps/org/feats/member/core/sql/001.sql: member.member.address may hold personal data: register it in cella.personal, or comment it \'not personal: why\'',
    'apps/org/feats/member/core/sql/001.sql: member.member.name may hold personal data: register it in cella.personal, or comment it \'not personal: why\'',
    'apps/org/feats/member/core/sql/001.sql: member.member.email may hold personal data: register it in cella.personal, or comment it \'not personal: why\'',
  ])
  const declared = await check({
    member: table + `
      INSERT INTO cella.personal (schema, tab, col, class, subject, owner) VALUES
        ('member', 'member', 'name', 'profile', 'address', 'member'),
        ('member', 'member', 'email', 'contact', 'address', 'member');
      COMMENT ON COLUMN member.member.address IS 'not personal: a pseudonym';`,
  })
  assert.deepEqual([declared.errors, undeclared(declared.found)], [[], []])
  const added = await check({ member: table + `ALTER TABLE member.member ADD COLUMN phone text;` })
  assert.match(undeclared(added.found).join('\n'), /member.member.phone may hold personal data/)
  const foreign = await check({ invoice: `INSERT INTO cella.personal (schema, tab, col, class, subject, owner) VALUES ('member', 'member', 'name', 'contact', 'address', 'invoice');` })
  assert.match(foreign.errors.join('\n'), /registers member.member.name as personal: a feat registers only its own schema's columns/)
})

test('the SQL check collects the literal guard and cites rows that back a check', async () => {
  const { errors, found } = await check({
    member: `INSERT INTO cella.guard (op, fn, owner) VALUES ('member:member:profile', 'member.own(jsonb)', 'member');`,
    'decision-member': `INSERT INTO decision.cites (op, owner) VALUES ('member:member:admit', 'decision-member');`,
  })
  assert.deepEqual(errors, [])
  assert.deepEqual(found.guards, [{ op: 'member:member:profile', owner: 'member' }])
  assert.deepEqual(found.cites, [{ op: 'member:member:admit', owner: 'decision-member' }])
})
