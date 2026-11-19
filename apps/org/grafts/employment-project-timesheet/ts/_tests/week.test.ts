// A worker's week, on a database holding the app's core, the project,
// timesheet and employment feats, the person core and the grafts beneath
// this one: no action of its own, and the week the grid enters, its
// days open once come while employed, its projects those booked to lately
// first, the circles each row offers, and what each cell holds. That the
// actor books their own time is the e2e scenario `participation`'s. Run
// by `cella test slice employment-project-timesheet`.

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
  // She sits in Web and in Brand, and sat in Marketing until before the
  // week; Ferrand's packaging is Brand's and Clairval's site Web's.
  await db.query(`INSERT INTO circle.circle (id, name) VALUES ('web', 'Web'), ('brand', 'Brand'), ('marketing', 'Marketing')`)
  await db.query(
    `INSERT INTO circle.member (circle, person, since, until) VALUES
       ('web', $1, '2026-10-21', NULL), ('brand', $1, '2026-09-01', NULL), ('marketing', $1, '2026-09-01', '2026-10-19')`,
    [ines],
  )
  await db.query(
    `INSERT INTO project.project (id, title, started, archived, circle) VALUES
       ('ferrand-packaging', 'Maison Ferrand, packaging', '2026-09-01', NULL, 'brand'),
       ('clairval-site', 'Ville de Clairval, town website', '2026-06-01', NULL, 'web'),
       ('mauve-posters', 'Compagnie Mauve Horizon, season posters', '2026-03-01', '2026-06-30', 'brand'),
       ('ondine-shop', 'Ondine, online shop', '2026-11-02', NULL, 'web')`,
  )
})

after(async () => {
  await db.end()
})

test('the week has no action of its own: each cell is the timesheet feat’s log, booked or not', async () => {
  const { rows } = await db.query(`SELECT op FROM cella.guard WHERE owner = 'employment-project-timesheet' UNION ALL SELECT op FROM cella.power WHERE owner = 'employment-project-timesheet'`)
  assert.deepEqual(rows, [])
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
  // Each row offers the circles she sits in that week, the project's
  // first, and for the coop's own time the root's, in which she has no
  // seat, so the others by name; Marketing's seat ended before it.
  assert.deepEqual(
    w.rows.map((r) => r.circles.map((c) => c.id)),
    [
      ['brand', 'web'],
      ['web', 'brand'],
      ['brand', 'web'],
    ],
  )
  assert.deepEqual(w.logged, { 'ferrand-packaging': { '2026-10-22': 180 }, '': { '2026-10-23': 420 } })
})

test('someone the coop does not employ has no week', async () => {
  assert.equal(await week(db, 'nadia@lanterne.example', '2026-10-19', '2026-10-24'), null)
  assert.equal(await week(db, null, '2026-10-19', '2026-10-24'), null)
})
