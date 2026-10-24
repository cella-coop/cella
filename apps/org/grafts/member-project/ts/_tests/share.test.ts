// The budget shares alone, on a database holding the app's core, the
// member and project feats and this graft: a share goes to an active
// member from a live project's budget and never beyond what is left of
// it, and `member_project.covers` refuses a budget below its shares. Run
// by `cella test slice member-project`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()
const hugo = 'hugo@lanterne.example'

const share = (project: string, member: string, cents: number) =>
  db.query(`INSERT INTO member_project.share (project, member, amount, granted) VALUES ($1, $2, cella.amount($3), '2026-10-24')`, [
    project,
    member,
    cents,
  ])

const refused = async (run: () => Promise<unknown>, says: RegExp) => {
  await db.query('BEGIN')
  try {
    await assert.rejects(run(), (e: Error & { code?: string }) => {
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
  await db.query(`INSERT INTO member.member (address, name, status, since, shares) VALUES ($1, 'Hugo Lefèvre', 'active', '2021-03-01', 40)`, [hugo])
  await db.query(`INSERT INTO member.member (address, name, status, shares) VALUES ('ines@lanterne.example', 'Inès Haddad', 'invited', 0)`)
  await db.query(
    `INSERT INTO project.project (id, title, started, budget) VALUES
       ('ferrand-packaging', 'Maison Ferrand, packaging', '2026-09-01', cella.amount(1400000)),
       ('unbudgeted', 'No budget yet', '2026-10-01', NULL)`,
  )
})

after(async () => {
  await db.end()
})

test('shares add up within the budget, and the pot says what is left', async () => {
  await share('ferrand-packaging', hugo, 200000)
  await share('ferrand-packaging', hugo, 1000000)
  const { rows } = await db.query(`SELECT budget, shared, remaining FROM member_project.pot WHERE project = 'ferrand-packaging'`)
  assert.deepEqual(rows[0], { budget: '1400000', shared: '1200000', remaining: '200000' })
})

test('a share beyond what is left of the budget is refused', async () => {
  await refused(() => share('ferrand-packaging', hugo, 200001), /a share of 200001 cents exceeds what is left of ferrand-packaging's budget, 200000 of 1400000 cents/)
})

test('a share goes to an active member, from a project with a budget', async () => {
  await refused(() => share('ferrand-packaging', 'ines@lanterne.example', 100), /ines@lanterne.example is no active member/)
  await refused(() => share('unbudgeted', hugo, 100), /unbudgeted has no budget to share/)
  await refused(() => share('nowhere', hugo, 100), /no project nowhere/)
})

test('member_project.covers refuses a budget below its shares', async () => {
  const covers = async () => (await db.query<{ r: string | null }>('SELECT member_project.covers($1) AS r', [{ project: 'ferrand-packaging' }])).rows[0].r
  assert.equal(await covers(), null)
  await db.query('BEGIN')
  await db.query(`UPDATE project.project SET budget = cella.amount(1000000) WHERE id = 'ferrand-packaging'`)
  assert.match((await covers()) ?? '', /ferrand-packaging's shares come to 1200000 cents, more than a budget of 1000000/)
  await db.query('ROLLBACK')
})
