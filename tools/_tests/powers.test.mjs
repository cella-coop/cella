// The feat check's power rules: what an action's label in actions.ts says it needs
// is what its feat registers in cella.power, or for an action a motion
// carries what motion.cites lists it with, and only the op's own feat
// registers it, and a mandate a fixture adopts grants it.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { agree, covered, granted, mandates } from '../powers.mjs'
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
    for (const feat of ['circle', 'motion', 'invoice', 'member']) {
      mkdirSync(join(repo, 'apps/org/feats', feat, 'core/sql'), { recursive: true })
      writeFileSync(join(repo, 'apps/org/feats', feat, 'feat.toml'), `name = "${feat}"\n`)
    }
    writeFileSync(join(repo, 'apps/org/feat.toml'), 'name = "org"\n')
    for (const [owner, text] of Object.entries(sql)) {
      const dir = owner.includes('-') ? join('apps/org/grafts', owner, 'sql') : join('apps/org/feats', owner, 'core/sql')
      mkdirSync(join(repo, dir), { recursive: true })
      writeFileSync(join(repo, dir, '001.sql'), text)
    }
    const found = { powers: [], guards: [], cites: [], stances: [], personal: [], impersonal: [], columns: [] }
    const known = new Set(['cella', 'circle', 'invoice', 'member', 'motion', 'circle_member', 'circle_invoice_member', 'member_motion', 'invoice_member'])
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
    'circle-invoice-member': guard('circle-member:seat:add', 'circle-invoice-member') + guard('member:member:admit', 'circle-invoice-member'),
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
  assert.match(odd[0], /declares the check anyone, which is none of first/)
})

test('a declared check is backed by SQL: a guard on the op', () => {
  const first = op('person:person:first', null, null, 'first')
  assert.match(covered([first], { guards: [], cites: [] })[0], /person:person:first checks first, but no SQL registers a guard on it in cella.guard/)
  assert.deepEqual(covered([first], { guards: [{ op: 'person:person:first', owner: 'person' }], cites: [] }), [])
})

test('a stance is no check: check roll is refused, with a guard on the op or without one, and a stance names vote', () => {
  const roll = covered([op('motion:motion:vote', null, null, 'roll')], { guards: [{ op: 'motion:motion:vote', owner: 'circle-membership-motion' }], cites: [] })
  assert.match(roll[0], /motion:motion:vote checks roll, which is no check: a stance needs the power its procedure gives the seats on the roll, so name it, vote, and list it in motion.stance_power/)
  const both = covered([op('motion:motion:vote', 'vote', null, 'roll')], { guards: [], cites: [] })
  assert.match(both[0], /motion:motion:vote checks roll, which is no check/)
  assert.deepEqual(covered([op('motion:motion:vote', 'vote')], { guards: [], cites: [] }), [])
})

test('a stance names the power motion.stance_power lists it with, which its procedure gives the seats on the roll, and is in no other register', () => {
  const vote = op('motion:motion:vote', 'vote')
  const given = (power, o = 'motion:motion:vote') => ({ op: o, power, owner: 'motion' })
  assert.deepEqual(agree([vote], [], [], [given('vote')]), [])
  assert.match(agree([vote], [], [], [given('ballot')])[0], /motion:motion:vote needs vote, but motion.stance_power lists it with ballot/)
  assert.match(agree([op('motion:motion:vote', 'vote', 'amount')], [], [], [given('vote')])[0], /caps no amount/)
  assert.match(agree([op('motion:motion:vote')], [], [], [given('vote')])[0], /motion:motion:vote needs no power, but motion.stance_power lists it with vote/)
  assert.match(agree([], [], [], [given('vote')])[0], /lists motion:motion:vote in motion.stance_power, which no actions.ts declares/)
  assert.match(agree([vote], [row('motion:motion:vote', 'vote', null, 'motion')], [], [given('vote')])[0], /listed in motion.stance_power and registered elsewhere: a stance's power is its procedure's alone/)
  assert.match(agree([vote], [], [])[0], /needs vote, which no SQL registers in cella.power, motion.cites or motion.stance_power/)
})

test('what is the actor\'s own is no check: an action of theirs names the power their right grants, and check self is refused', () => {
  const self = covered([op('member:member:profile', null, null, 'self')], { guards: [{ op: 'member:member:profile', owner: 'member' }], cites: [] })
  assert.match(self[0], /member:member:profile checks self, which is no check: .* so name the power, as keep-profile or log-time/)
  const both = covered([op('member:member:profile', 'keep-profile', null, 'self')], { guards: [], cites: [] })
  assert.match(both[0], /member:member:profile checks self, which is no check/)
  assert.deepEqual(covered([op('member:member:profile', 'keep-profile')], { guards: [], cites: [] }), [])
})

test('a passed motion is no check: check decided is refused, with a power or without one, even listed in motion.cites', () => {
  const decided = op('member:member:admit', null, null, 'decided')
  const cites = [{ op: 'member:member:admit', power: 'admit-member', owner: 'member-motion' }]
  assert.match(covered([decided], { guards: [{ op: 'member:member:admit', owner: 'member' }], cites })[0], /member:member:admit checks decided, which is no check: .* name the power and list it in motion.cites, as admit-member/)
  const both = covered([op('member:member:admit', 'admit-member', null, 'decided')], { guards: [], cites })
  assert.match(both[0], /member:member:admit checks decided, which is no check/)
  assert.deepEqual(covered([op('member:member:admit', 'admit-member')], { guards: [], cites }), [])
})

test('an action a motion carries names the power motion.cites lists it with, a collective mandate\'s, and is in no cella.power', () => {
  const admit = op('member:member:admit', 'admit-member')
  const cite = (power, owner = 'member-motion') => ({ op: 'member:member:admit', power, owner })
  assert.deepEqual(agree([admit], [], [cite('admit-member')]), [])
  assert.match(agree([admit], [], [cite('suspend-member')])[0], /member:member:admit needs admit-member, but motion.cites lists it with suspend-member/)
  assert.match(agree([op('member:member:admit', 'admit-member', 'amount')], [], [cite('admit-member')])[0], /a collective mandate's, which caps no amount/)
  assert.match(agree([op('member:member:admit')], [], [cite('admit-member')])[0], /member:member:admit needs admit-member in motion.cites, which its label does not name/)
  assert.match(agree([], [], [cite('admit-member')])[0], /lists member:member:admit in motion.cites, which no actions.ts declares/)
  assert.match(agree([admit], [row('member:member:admit', 'admit-member')], [cite('admit-member')])[0], /registered in cella.power and listed in motion.cites: a power is a seat's or a motion's, never both/)
  assert.match(agree([admit], [], [])[0], /needs admit-member, which no SQL registers in cella.power, motion.cites or motion.stance_power/)
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

test('the SQL check collects the literal guard and cites rows, each cite with its power', async () => {
  const { errors, found } = await check({
    member: `INSERT INTO cella.guard (op, fn, owner) VALUES ('member:member:profile', 'member.own(jsonb)', 'member');`,
    'member-motion': `INSERT INTO motion.cites (op, power, owner) VALUES ('member:member:admit', 'admit-member', 'member-motion');`,
  })
  assert.deepEqual(errors, [])
  assert.deepEqual(found.guards, [{ op: 'member:member:profile', owner: 'member' }])
  assert.deepEqual(found.cites, [{ op: 'member:member:admit', power: 'admit-member', owner: 'member-motion' }])
  const stances = await check({ motion: `INSERT INTO motion.stance_power (op, power, owner) VALUES ('motion:motion:vote', 'vote', 'motion');` })
  assert.deepEqual([stances.errors, stances.found.stances], [[], [{ op: 'motion:motion:vote', power: 'vote', owner: 'motion' }]])
})

test('a seat is no check: an action a seat allows names the participant\'s power, and check seat is refused', () => {
  const seat = covered([op('motion:motion:propose', null, null, 'seat')], { guards: [{ op: 'motion:motion:propose', owner: 'circle-membership-motion' }], cites: [] })
  assert.match(seat[0], /motion:motion:propose checks seat, which is no check: .* name the power, as propose or discuss/)
  const both = covered([op('motion:motion:propose', 'propose', null, 'seat')], { guards: [], cites: [] })
  assert.match(both[0], /motion:motion:propose checks seat, which is no check/)
  assert.deepEqual(covered([op('motion:motion:propose', 'propose')], { guards: [], cites: [] }), [])
})

test('a power no mandate, collective mandate or right a fixture adopts grants is refused, but a stance\'s', () => {
  const motion = (closed, ...wordings) => ({
    id: 'm-1',
    closed,
    action: wordings.map((wording) => ({ kind: 'policy', args: { kind: 'mandate', wording } })),
  })
  const grants = mandates([
    motion('2021-03-01', 'The {role: finance} role holds {power: issue-invoice}, up to {limit: 3 000 €} a write', 'Every {right: member} holds {power: draw-account}'),
    motion(undefined, 'The {circle: ag} circle holds {power: admit-member}, by motion'),
    { id: 'm-2', closed: '2021-03-01', action: [{ kind: 'policy', args: { kind: 'rule', wording: 'A {power: pay-supplier} is no mandate' } }] },
  ], 'lanterne')
  assert.deepEqual(grants.map((g) => g.power), ['issue-invoice', 'draw-account'])
  assert.deepEqual(granted([op('invoice:invoice:issue', 'issue-invoice'), op('account:account:draw', 'draw-account')], grants), [])

  const [open] = granted([op('membership:member:admit', 'admit-member')], grants)
  assert.match(open, /membership:member:admit needs admit-member, which no mandate, collective mandate or right grants in lanterne/)
  assert.match(granted([op('transaction:transaction:pay', 'pay-supplier')], grants)[0], /needs pay-supplier, which no mandate/)
  assert.match(granted([op('invoice:invoice:issue', 'issue-invoice')], [])[0], /grants in no fixture/)

  const stance = op('motion:stance:give', 'vote')
  assert.deepEqual(granted([stance], grants, [{ op: 'motion:stance:give', power: 'vote', owner: 'motion' }]), [])
  assert.deepEqual(granted([op('import:state:carry', null, null, 'first')], grants), [])
})
