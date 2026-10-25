// Who a power opens a personal file to, on a database holding the app's
// core, the circle, file and member feats and the grafts below this one:
// a seat whose mandate approves or reimburses expenses opens receipts,
// one that hires opens employment records, and nothing opens the co-op's
// own beyond what the file feat does, nor a file to someone with no such
// seat. Run by `cella test slice circle-file-membership`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { opens } from '../src/api/index.ts'

const db = new pg.Client()
const julien = 'julien@lanterne.example'
const camille = 'camille@lanterne.example'
const sofia = 'sofia@lanterne.example'

before(async () => {
  await db.connect()
  await db.query(`SET cella.clock = '2026-10-24'`)
  await db.query(`WITH person AS (INSERT INTO person.person (address, name) VALUES ($1, 'Julien'), ($2, 'Camille'), ($3, 'Sofia') ON CONFLICT DO NOTHING) INSERT INTO membership.member (address, status, since, shares) VALUES ($1, 'active', '2021-09-01', 20), ($2, 'active', '2021-03-01', 40), ($3, 'active', '2022-09-05', 20)`, [julien, camille, sofia])
  await db.query(`INSERT INTO circle.circle (id, name, parent) VALUES ('ag', 'ag', NULL)`)
  await db.query(`INSERT INTO circle.role (id, circle, name) VALUES ('finance', 'ag', 'Finance'), ('manager', 'ag', 'Gérante')`)
  await db.query(`INSERT INTO circle.mandate (role, power, text) VALUES ('finance', 'reimburse-expense', 'reimburse'), ('manager', 'hire-worker', 'hire')`)
  await db.query(`INSERT INTO circle_membership.position (circle, member, role, until) VALUES ('ag', $1, 'finance', NULL), ('ag', $2, 'manager', NULL)`, [julien, camille])
  await db.query(
    `INSERT INTO file.file (id, class, subject, name, type, size, bytes, uploader, uploaded) VALUES
       ('fi-0001', 'expense-receipt', $1, 'ticket.pdf', 'application/pdf', 1, '\\x00', $1, '2026-10-20'),
       ('fi-0002', 'payroll', 'ines@lanterne.example', 'contrat.pdf', 'application/pdf', 1, '\\x00', $2, '2025-08-25')`,
    [sofia, camille],
  )
})

after(async () => {
  await db.end()
})

test('a power over expenses opens receipts, and only receipts', async () => {
  assert.equal(await opens(db, 'fi-0001', julien), true)
  assert.equal(await opens(db, 'fi-0002', julien), false)
})

test('a power to hire opens employment records', async () => {
  assert.equal(await opens(db, 'fi-0002', camille), true)
  assert.equal(await opens(db, 'fi-0001', camille), false)
})

test('no seat opens nothing, and no one acting opens nothing', async () => {
  assert.equal(await opens(db, 'fi-0002', sofia), false)
  assert.equal(await opens(db, 'fi-0001', null), false)
  assert.equal(await opens(db, 'fi-0009', julien), false)
})
