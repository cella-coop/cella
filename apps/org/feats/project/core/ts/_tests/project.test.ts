// The projects alone, on a database holding only the app's core and this
// feat: a project's id is a slug, milestones number in order, an archived
// project is frozen, and `project.budgets` checks the write set the
// budget it names. Run by `cella test slice project`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()

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

const budgets = async (payload: object) =>
  (await db.query<{ r: string | null }>('SELECT project.budgets($1) AS r', [payload])).rows[0].r

before(async () => {
  await db.connect()
  await db.query(
    `INSERT INTO project.project (id, title, circle, started, budget)
     VALUES ('ferrand-packaging', 'Maison Ferrand, packaging', 'brand', '2026-09-01', cella.amount(1400000))`,
  )
})

after(async () => {
  await db.end()
})

test('only the app\'s core and this feat are migrated', async () => {
  const { rows } = await db.query(`SELECT nspname FROM pg_namespace WHERE nspname IN ('client', 'client_project', 'member_project', 'task')`)
  assert.deepEqual(rows, [])
})

test('a project\'s id is a slug', async () => {
  await db.query('BEGIN')
  await assert.rejects(
    db.query(`INSERT INTO project.project (id, title, started) VALUES ('Ferrand Packaging', 'x', '2026-09-01')`),
    /project_id_check/,
  )
  await db.query('ROLLBACK')
})

test('milestones number in the order they were added; the progress counts the complete ones and names the next', async () => {
  for (const [n, title, completed] of [
    [1, 'Range concept', '2026-09-11'],
    [2, 'Six packs, print-ready', '2026-09-25'],
    [3, 'Print supervision', null],
  ] as const) {
    await db.query('INSERT INTO project.milestone (project, n, title, completed) VALUES ($1, $2, $3, $4)', ['ferrand-packaging', n, title, completed])
  }
  const { rows } = await db.query('SELECT milestones, completed, next FROM project.progress WHERE id = $1', ['ferrand-packaging'])
  assert.deepEqual(rows[0], { milestones: 3, completed: 2, next: 'Print supervision' })
})

test('project.budgets passes the budget the write set, and refuses one it did not, or no project', async () => {
  assert.equal(await budgets({ project: 'ferrand-packaging', amount: 1400000 }), null)
  assert.match((await budgets({ project: 'ferrand-packaging', amount: 2000000 })) ?? '', /ferrand-packaging's budget was not set by this write/)
  assert.equal(await budgets({ project: 'nowhere', amount: 1 }), 'no project nowhere')
})

test('an archived project is frozen: no budget, no milestone, no completion', async () => {
  await db.query(
    `INSERT INTO project.project (id, title, started, budget, archived)
     VALUES ('ondine-shop', 'Atelier Ondine, online shop', '2026-05-18', cella.amount(950000), '2026-09-01')`,
  )
  await refused(`UPDATE project.project SET budget = cella.amount(1) WHERE id = 'ondine-shop'`, [], /ondine-shop was archived on 2026-09-01/)
  await refused(
    `INSERT INTO project.milestone (project, n, title) VALUES ('ondine-shop', 1, 'More')`,
    [],
    /ondine-shop was archived on 2026-09-01: its milestones change no more/,
  )
})
