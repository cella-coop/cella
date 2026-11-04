// Who is expected at a meeting, on a database holding the app's core, the
// circle, meeting and member feats and the grafts beneath this one: the
// roll is the circle's seats on the meeting's day, guests apart; the
// quorum counts seated members present against the circle's share; the
// minutes' keeper records only those expected; and the agenda's guard
// wants a seat. Run by `cella test slice meeting-membership`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()
const at = (name: string) => `${name}@roll.example`
const seated = ['camille', 'yusuf', 'hugo', 'malik', 'julien']

const guard = async (fn: string, payload: object) =>
  (await db.query<{ r: string | null }>(`SELECT meeting_membership.${fn}($1) AS r`, [payload])).rows[0].r

before(async () => {
  await db.connect()
  for (const name of [...seated, 'thomas']) {
    await db.query(`WITH person AS (INSERT INTO person.person (address, name) VALUES ($1, $2) ON CONFLICT DO NOTHING) INSERT INTO membership.member (address, status, since, shares) VALUES ($1, 'active', '2021-03-01', 20)`, [at(name), name])
  }
  await db.query(`INSERT INTO circle.circle (id, name, assembly) VALUES ('ag', 'Assemblée générale', true) ON CONFLICT DO NOTHING`)
  await db.query(`INSERT INTO circle.circle (id, name) VALUES ('brand', 'Brand'), ('web', 'Web')`)
  for (const name of seated) {
    await db.query(`INSERT INTO circle.member (circle, person) VALUES ('brand', $1)`, [at(name)])
  }
  // Julien left Brand on 20 October: expected on the 19th, not the 26th.
  await db.query(`UPDATE circle.member SET until = '2026-10-20' WHERE person = $1`, [at('julien')])
  await db.query(`INSERT INTO circle.member (circle, person) VALUES ('web', $1)`, [at('thomas')])
  await db.query(`INSERT INTO meeting.setting (circle, quorum) VALUES ('brand', 60)`)
  await db.query(
    `INSERT INTO meeting.meeting (id, circle, title, at) VALUES
       ('brand-2026-10-19', 'brand', 'Brand', '2026-10-19 10:00'),
       ('brand-2026-10-26', 'brand', 'Brand', '2026-10-26 10:00')`,
  )
  for (const [member, status] of [
    ['camille', 'present'],
    ['yusuf', 'present'],
    ['hugo', 'excused'],
    ['thomas', 'present'],
  ]) {
    await db.query(`INSERT INTO meeting_membership.attendance (meeting, member, status) VALUES ('brand-2026-10-19', $1, $2)`, [at(member), status])
  }
})

after(async () => {
  await db.end()
})

test('the roll is the circle\'s seats on the meeting\'s day, then the guests', async () => {
  const roll = async (meeting: string) =>
    (await db.query<{ member: string; seated: boolean; status: string | null }>(
      'SELECT member, seated, status FROM meeting_membership.roll WHERE meeting = $1 ORDER BY seated DESC, member',
      [meeting],
    )).rows.map((r) => `${r.member.split('@')[0]}:${r.seated ? 'seat' : 'guest'}:${r.status ?? '-'}`)
  assert.deepEqual(await roll('brand-2026-10-19'), [
    'camille:seat:present',
    'hugo:seat:excused',
    'julien:seat:-',
    'malik:seat:-',
    'yusuf:seat:present',
    'thomas:guest:present',
  ])
  assert.deepEqual(await roll('brand-2026-10-26'), ['camille:seat:-', 'hugo:seat:-', 'malik:seat:-', 'yusuf:seat:-'])
})

test('the quorum counts seated members present against the circle\'s share, guests for nothing', async () => {
  const { rows } = await db.query(`SELECT meeting, seats, present, needed FROM meeting_membership.quorum WHERE meeting LIKE 'brand-%' ORDER BY meeting`)
  assert.deepEqual(rows, [
    { meeting: 'brand-2026-10-19', seats: 5, present: 2, needed: 3 },
    { meeting: 'brand-2026-10-26', seats: 4, present: 0, needed: 3 },
  ])
})

test('the minutes\' keeper records only those expected; anyone else marks themselves', async () => {
  assert.equal(await guard('records', { meeting: 'brand-2026-10-26', member: at('hugo') }), null)
  assert.equal(
    await guard('records', { meeting: 'brand-2026-10-26', member: at('thomas') }),
    'thomas@roll.example holds no seat in brand on 2026-10-26: only they may mark themselves, as a guest',
  )
  assert.equal(
    await guard('records', { meeting: 'brand-2026-10-26', member: at('julien') }),
    'julien@roll.example holds no seat in brand on 2026-10-26: only they may mark themselves, as a guest',
    'his seat ended before the meeting',
  )
})

test('outside a write there is no actor: no seat for the agenda', async () => {
  assert.equal(await guard('sits', { meeting: 'brand-2026-10-26' }), 'an agenda is drawn up by a member of its circle, and this write has no actor')
  assert.equal(await guard('sits', { meeting: 'nowhere' }), 'no meeting nowhere')
})
