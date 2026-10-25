// Attendance, on a database holding the app's core, the meeting and
// member feats and this graft: a mark is a register per member, taken
// only while the meeting is scheduled and only of an active member, and
// `meeting_membership.marks` refuses a mark not the actor's own. Run by
// `cella test slice meeting-membership`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()
const malik = 'malik@lanterne.example'
const ines = 'ines@lanterne.example'

const refused = async (sql: string, values: unknown[], says: RegExp) => {
  await db.query('BEGIN')
  try {
    await assert.rejects(db.query(sql, values), (e: Error & { code?: string }) => {
      assert.equal(e.code, '09000', e.message)
      assert.match(e.message, says)
      return true
    })
  } finally {
    await db.query('ROLLBACK')
  }
}

before(async () => {
  await db.connect()
  await db.query(
    `WITH person AS (INSERT INTO person.person (address, name) VALUES ($1, 'Malik Benali') ON CONFLICT DO NOTHING) INSERT INTO membership.member (address, status, since, shares) VALUES ($1, 'active', '2022-11-02', 20)`,
    [malik],
  )
  await db.query(`WITH person AS (INSERT INTO person.person (address, name) VALUES ($1, 'Inès Haddad') ON CONFLICT DO NOTHING) INSERT INTO membership.member (address, status, shares, invited) VALUES ($1, 'invited', 0, '2026-09-30')`, [ines])
  await db.query(
    `INSERT INTO meeting.meeting (id, circle, title, at) VALUES
       ('coordination-2026-10-19', 'coordination', 'Coordination', '2026-10-19 10:00'),
       ('coordination-2026-10-26', 'coordination', 'Coordination', '2026-10-26 10:00')`,
  )
  await db.query(`INSERT INTO meeting_membership.attendance (meeting, member, status) VALUES ('coordination-2026-10-19', $1, 'present')`, [malik])
  await db.query(`UPDATE meeting.meeting SET status = 'held', settled = '2026-10-19' WHERE id = 'coordination-2026-10-19'`)
})

after(async () => {
  await db.end()
})

test('a mark is a register: the last one stands', async () => {
  await db.query('BEGIN')
  for (const status of ['present', 'excused']) {
    await db.query(
      `INSERT INTO meeting_membership.attendance (meeting, member, status) VALUES ('coordination-2026-10-26', $1, $2)
       ON CONFLICT (meeting, member) DO UPDATE SET status = excluded.status`,
      [malik, status],
    )
  }
  const { rows } = await db.query(`SELECT status FROM meeting_membership.attendance WHERE meeting = 'coordination-2026-10-26'`)
  assert.deepEqual(rows, [{ status: 'excused' }])
  await db.query('ROLLBACK')
})

test('who came to a held meeting is fixed', async () => {
  await refused(
    `UPDATE meeting_membership.attendance SET status = 'absent' WHERE meeting = 'coordination-2026-10-19'`,
    [],
    /coordination-2026-10-19 was held on 2026-10-19: who came is fixed/,
  )
})

test('only an active member attends, and only a meeting that exists', async () => {
  await refused(
    `INSERT INTO meeting_membership.attendance (meeting, member, status) VALUES ('coordination-2026-10-26', $1, 'present')`,
    [ines],
    /ines@lanterne.example is no active member: only a member attends/,
  )
  await refused(`INSERT INTO meeting_membership.attendance (meeting, member, status) VALUES ('nowhere', $1, 'present')`, [malik], /no meeting nowhere/)
})

test('outside a write there is no actor, so no mark is the actor\'s own', async () => {
  const { rows } = await db.query<{ r: string }>('SELECT meeting_membership.marks($1) AS r', [{ meeting: 'coordination-2026-10-26', member: malik }])
  assert.equal(rows[0].r, `only ${malik} marks their own attendance; another's is recorded by the minutes' keeper`)
})
