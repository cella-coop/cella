// What a decision asks of members, on a database holding the app's core,
// the decision and member feats and this graft: the kinds it registers,
// `decision_member.asks` checking each motion applies to its member, and
// the rules on a suspension and an exit naming what the cited decision
// asks. Run by `cella test slice decision-member`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()

const rule = async (fn: string, payload: object) => (await db.query<{ r: string | null }>(`SELECT decision_member.${fn}($1) AS r`, [payload])).rows[0].r

before(async () => {
  await db.connect()
  await db.query(
    `INSERT INTO member.member (address, name, status, shares) VALUES
       ('ines@lanterne.example', 'Inès Haddad', 'invited', 0),
       ('chloe@lanterne.example', 'Chloé Moreau', 'active', 20),
       ('old@lanterne.example', 'Old', 'exited', 0)`,
  )
  await db.query(
    `INSERT INTO decision.decision (id, circle, title, rule, procedure, proposed, deadline) VALUES
       ('d-1', 'ag', 'Admit Inès', 'consent', 'consent', '2026-10-14', '2026-10-31'),
       ('d-2', 'ag', 'Admit Chloé again', 'consent', 'consent', '2026-10-14', '2026-10-31'),
       ('d-3', 'ag', 'Suspend Chloé', 'consent', 'consent', '2026-10-14', '2026-10-31'),
       ('d-4', 'ag', 'Let the old go again', 'consent', 'consent', '2026-10-14', '2026-10-31')`,
  )
  await db.query(
    `INSERT INTO decision.motion (decision, n, kind, args) VALUES
       ('d-1', 1, 'admit', '{"member": "ines@lanterne.example", "shares": 20}'),
       ('d-2', 1, 'admit', '{"member": "chloe@lanterne.example", "shares": 5}'),
       ('d-3', 1, 'suspend', '{"member": "chloe@lanterne.example"}'),
       ('d-4', 1, 'exit', '{"member": "old@lanterne.example"}')`,
  )
})

after(async () => {
  await db.end()
})

test('the graft registers admitting, suspending and ending a membership, and erasing a former member', async () => {
  const { rows } = await db.query(`SELECT kind FROM decision.kind WHERE owner = 'decision-member' ORDER BY kind`)
  assert.deepEqual(rows.map((r) => r.kind), ['admit', 'erase', 'exit', 'suspend'])
})

test('a proposal asks of each member what can become of them', async () => {
  assert.equal(await rule('asks', { decision: 'd-1' }), null)
  assert.equal(await rule('asks', { decision: 'd-3' }), null)
  assert.equal(await rule('asks', { decision: 'd-2' }), 'chloe@lanterne.example is active, not invited')
  assert.equal(await rule('asks', { decision: 'd-4' }), 'old@lanterne.example is exited')
})

test('a suspension or an exit cites a decision that asks it of that member', async () => {
  assert.match((await rule('admits', { decision: 'd-1', member: 'ines@lanterne.example', shares: 40 })) ?? '', /d-1 does not admit ines@lanterne.example with 40 shares/)
  assert.equal(await rule('admits', { decision: 'd-1', member: 'ines@lanterne.example', shares: 20 }), null)
  assert.equal(await rule('ends', { decision: 'nowhere', member: 'chloe@lanterne.example' }), 'no decision nowhere')
})

test('a close admits only whom the decision asks to admit', async () => {
  assert.equal(await rule('closes', { decision: 'd-3', admitted: [] }), null)
  assert.equal(await rule('closes', { decision: 'd-3', admitted: [{ member: 'chloe@lanterne.example' }] }), 'd-3 does not admit chloe@lanterne.example')
})
