// A worker's week, on a database holding the app's core, the project,
// timesheet and employment feats, the person core and the grafts beneath this one: the rules
// that judge booking by employment, and the week the grid enters, its
// days open once come while employed, its projects those booked to lately
// first, and what each cell holds. That the actor books their own time is
// the e2e scenario `participation`'s. Run by
// `cella test slice employment-project-timesheet`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { week, monday } from '../src/drivers/week.ts'

const db = new pg.Client()
const ines = 'ines@lanterne.example'

const entry = async (day: string, minutes: number, project?: string) => {
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO timesheet.entry (member, day, minutes, billable, note) VALUES ($1, $2, $3, $4, '') RETURNING id::text AS id`,
    [ines, day, minutes, !!project],
  )
  if (project) {
    await db.query('INSERT INTO project_timesheet.booking (entry, project) VALUES ($1, $2)', [rows[0].id, project])
  }
}

before(async () => {
  await db.connect()
  await db.query(
    `WITH person AS (INSERT INTO person.person (address, name) VALUES ($1, 'Inès Haddad') ON CONFLICT DO NOTHING)
     INSERT INTO employment.worker (address, name, job, contract, start, until, minutes, hired)
     VALUES ($1, 'Inès Haddad', 'junior developer', 'permanent', '2026-10-21', NULL, 2100, '2026-10-21')`,
    [ines],
  )
  await db.query(
    `INSERT INTO project.project (id, title, started, archived) VALUES
       ('ferrand-packaging', 'Maison Ferrand, packaging', '2026-09-01', NULL),
       ('clairval-site', 'Ville de Clairval, town website', '2026-06-01', NULL),
       ('mauve-posters', 'Compagnie Mauve Horizon, season posters', '2026-03-01', '2026-06-30'),
       ('ondine-shop', 'Ondine, online shop', '2026-11-02', NULL)`,
  )
})

after(async () => {
  await db.end()
})

test('booking by employment is judged as a worker’s log: their own time, while employed', async () => {
  const { rows } = await db.query(`SELECT fn::text AS fn FROM cella.rule WHERE op = 'employment-project-timesheet:entry:book' ORDER BY fn::text`)
  assert.deepEqual(rows, [{ fn: 'employment_timesheet.works(jsonb)' }, { fn: 'timesheet.logs(jsonb)' }])
})

test('a week runs from its Monday', () => {
  assert.equal(monday('2026-10-25'), '2026-10-19')
  assert.equal(monday('2026-10-19'), '2026-10-19')
  assert.equal(monday('2026-11-01'), '2026-10-26')
})

test('the week: days open once come while employed, the projects booked to lately first, what each cell holds', async () => {
  await entry('2026-10-22', 120, 'ferrand-packaging')
  await entry('2026-10-22', 60, 'ferrand-packaging')
  await entry('2026-10-23', 420)
  const w = await week(db, ines, '2026-10-19', '2026-10-24')
  assert.ok(w)
  assert.deepEqual(
    w.days.map((d) => [d.day.slice(8), d.open]),
    [
      ['19', false],
      ['20', false],
      ['21', true],
      ['22', true],
      ['23', true],
      ['24', true],
      ['25', false],
    ],
  )
  // Archived projects and those not started by its Sunday are not offered.
  assert.deepEqual(
    w.rows.map((r) => r.project),
    ['ferrand-packaging', 'clairval-site', ''],
  )
  assert.deepEqual(w.logged, { 'ferrand-packaging': { '2026-10-22': 180 }, '': { '2026-10-23': 420 } })
})

test('someone the co-op does not employ has no week', async () => {
  assert.equal(await week(db, 'nadia@lanterne.example', '2026-10-19', '2026-10-24'), null)
  assert.equal(await week(db, null, '2026-10-19', '2026-10-24'), null)
})
