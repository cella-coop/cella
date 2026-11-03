// What a motion asks of members, on a database holding the app's core,
// the motion and member feats and this graft: the kinds it registers,
// `membership_motion.asks` checking each action applies to its member, and
// the guards on a suspension and an exclusion naming what the cited motion
// asks. Run by `cella test slice membership-motion`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()

const guard = async (fn: string, payload: object) => (await db.query<{ r: string | null }>(`SELECT membership_motion.${fn}($1) AS r`, [payload])).rows[0].r

before(async () => {
  await db.connect()
  await db.query(
    `WITH person AS (INSERT INTO person.person (address, name) VALUES ('ines@lanterne.example', 'Inès Haddad'),
       ('chloe@lanterne.example', 'Chloé Moreau'),
       ('old@lanterne.example', 'Old') ON CONFLICT DO NOTHING) INSERT INTO membership.member (address, status, shares) VALUES
       ('ines@lanterne.example', 'invited', 0),
       ('chloe@lanterne.example', 'active', 20),
       ('old@lanterne.example', 'exited', 0)`,
  )
  await db.query(
    `INSERT INTO motion.motion (id, circle, title, method, procedure, proposed, deadline) VALUES
       ('m-1', 'ag', 'Admit Inès', 'consent', 'consent', '2026-10-14', '2026-10-31'),
       ('m-2', 'ag', 'Admit Chloé again', 'consent', 'consent', '2026-10-14', '2026-10-31'),
       ('m-3', 'ag', 'Suspend Chloé', 'consent', 'consent', '2026-10-14', '2026-10-31'),
       ('m-4', 'ag', 'Let the old go again', 'consent', 'consent', '2026-10-14', '2026-10-31')`,
  )
  await db.query(
    `INSERT INTO motion.action (motion, n, kind, args) VALUES
       ('m-1', 1, 'admit', '{"member": "ines@lanterne.example", "shares": 20}'),
       ('m-2', 1, 'admit', '{"member": "chloe@lanterne.example", "shares": 5}'),
       ('m-3', 1, 'suspend', '{"member": "chloe@lanterne.example"}'),
       ('m-4', 1, 'exclude', '{"member": "old@lanterne.example"}')`,
  )
})

after(async () => {
  await db.end()
})

test('the graft registers admitting, suspending and excluding a member', async () => {
  const { rows } = await db.query(`SELECT kind FROM motion.carries WHERE owner = 'membership-motion' ORDER BY kind`)
  assert.deepEqual(rows.map((r) => r.kind), ['admit', 'exclude', 'suspend'])
})

test('a proposal asks of each member what can become of them', async () => {
  assert.equal(await guard('asks', { motion: 'm-1' }), null)
  assert.equal(await guard('asks', { motion: 'm-3' }), null)
  assert.equal(await guard('asks', { motion: 'm-2' }), 'chloe@lanterne.example is active, not invited')
  assert.equal(await guard('asks', { motion: 'm-4' }), 'old@lanterne.example is exited')
})

test('a suspension or an exclusion cites a motion that asks it of that member', async () => {
  assert.match((await guard('admits', { motion: 'm-1', member: 'ines@lanterne.example', shares: 40 })) ?? '', /m-1 does not admit ines@lanterne.example with 40 shares/)
  assert.equal(await guard('admits', { motion: 'm-1', member: 'ines@lanterne.example', shares: 20 }), null)
  assert.equal(await guard('ends', { motion: 'nowhere', member: 'chloe@lanterne.example' }), 'no motion nowhere')
})

test('a close admits only whom the motion asks to admit', async () => {
  assert.equal(await guard('closes', { motion: 'm-3', admitted: [] }), null)
  assert.equal(await guard('closes', { motion: 'm-3', admitted: [{ member: 'chloe@lanterne.example' }] }), 'm-3 does not admit chloe@lanterne.example')
})
