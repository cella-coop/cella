// The meeting feat's folds (`sql/006-folds.sql`), on a database holding
// the app's core and this feat, in a transaction rolled back after: a
// meeting folds scheduled under its id on the entry's day; an item added
// under its id at the position its entry gives, its presenter as its
// commitment, in its meeting's circle, then moved and removed; the
// minutes begun keep their first day; a meeting folds held on its entry's
// day, and another cancelled. Run by `cella test slice meeting`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()
const malik = 'malik@folded.example'
const commitment = { $commit: 'ab'.repeat(32) }

const one = async <R>(sql: string, values: unknown[] = []) => (await db.query(sql, values)).rows[0] as R
const fold = (fn: string, n: number, op: string, date: string, payload: unknown) =>
  db.query(`SELECT meeting.${fn}($1)`, [{ n, op, actor: malik, date, cause: null, payload }])

before(async () => {
  await db.connect()
  await db.query('BEGIN')
  await db.query(`INSERT INTO circle.circle (id, name) VALUES ('folding', 'Folding') ON CONFLICT DO NOTHING`)
})

after(async () => {
  await db.query('ROLLBACK')
  await db.end()
})

test('a meeting folds scheduled, its agenda added, moved and removed, minuted and held', async () => {
  const meeting = 'folding-2041-03-04'
  await fold('fold_schedule', 1, 'meeting:meeting:schedule', '2041-03-01', {
    meeting, circle: 'folding', at: '2041-03-04T10:00', title: 'Folding', place: 'Studio', link: 'https://meet.example/f',
  })
  assert.deepEqual(
    await one(`SELECT circle, title, to_char(at, 'YYYY-MM-DD"T"HH24:MI') AS at, place, link, to_char(scheduled, 'YYYY-MM-DD') AS scheduled, status FROM meeting.meeting WHERE id = $1`, [meeting]),
    { circle: 'folding', title: 'Folding', at: '2041-03-04T10:00', place: 'Studio', link: 'https://meet.example/f', scheduled: '2041-03-01', status: 'scheduled' },
  )
  await fold('fold_add', 2, 'meeting:item:add', '2041-03-01', { meeting, item: 990001, pos: '1', title: 'Pipeline', presenter: commitment, minutes: 20 })
  await fold('fold_add', 3, 'meeting:item:add', '2041-03-01', { meeting, item: 990002, pos: '2', title: 'Staffing', presenter: commitment, minutes: null })
  await fold('fold_add', 4, 'meeting:item:add', '2041-03-01', { meeting, item: 990003, pos: '3', title: 'Other', presenter: commitment, minutes: 5 })
  await fold('fold_move', 5, 'meeting:item:move', '2041-03-02', { meeting, item: 990002, pos: '0.5' })
  await fold('fold_remove', 6, 'meeting:item:remove', '2041-03-02', { meeting, item: 990003 })
  assert.deepEqual((await db.query(`SELECT id::int, pos, title, presenter, minutes, circle FROM meeting.item WHERE meeting = $1 ORDER BY pos`, [meeting])).rows, [
    { id: 990002, pos: 0.5, title: 'Staffing', presenter: 'redacted', minutes: null, circle: 'folding' },
    { id: 990001, pos: 1, title: 'Pipeline', presenter: 'redacted', minutes: 20, circle: 'folding' },
  ])
  assert.equal((await one<{ n: string }>(`SELECT count(*) AS n FROM cella.commitment WHERE field = 'meeting.item.presenter' AND subject IN ('990001', '990002')`)).n, '2')
  await fold('fold_hold', 7, 'meeting:meeting:hold', '2041-03-04', { meeting, circle: 'folding', status: 'held', settled: '2041-03-04' })
  await fold('fold_minute', 8, 'meeting:meeting:minute', '2041-03-05', { meeting, circle: 'folding', minuted: '2041-03-05' })
  await fold('fold_minute', 9, 'meeting:meeting:minute', '2041-03-06', { meeting, circle: 'folding', minuted: '2041-03-05' })
  assert.deepEqual(
    await one(`SELECT status, to_char(settled, 'YYYY-MM-DD') AS settled, to_char(minuted, 'YYYY-MM-DD') AS minuted FROM meeting.meeting WHERE id = $1`, [meeting]),
    { status: 'held', settled: '2041-03-04', minuted: '2041-03-05' },
  )
})

test('a meeting folds cancelled on its entry\'s day', async () => {
  const meeting = 'folding-2041-03-11'
  await fold('fold_schedule', 10, 'meeting:meeting:schedule', '2041-03-01', { meeting, circle: 'folding', at: '2041-03-11T10:00', title: 'Folding', place: '', link: null })
  await fold('fold_cancel', 11, 'meeting:meeting:cancel', '2041-03-08', { meeting, circle: 'folding', status: 'cancelled', settled: '2041-03-08' })
  assert.deepEqual(await one(`SELECT status, to_char(settled, 'YYYY-MM-DD') AS settled, link FROM meeting.meeting WHERE id = $1`, [meeting]), {
    status: 'cancelled',
    settled: '2041-03-08',
    link: null,
  })
})
