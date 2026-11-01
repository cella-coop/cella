// The expenses alone, on a database holding only the app's core and this
// feat: an expense moves only along its lifecycle, its figures never change
// once submitted, and the guards refuse a write that did not do what it
// says. Run by `cella test slice expense`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()
const sofia = 'sofia@lanterne.example'

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

const guard = async (fn: string, payload: object) =>
  (await db.query<{ r: string | null }>(`SELECT expense.${fn}($1) AS r`, [payload])).rows[0].r

before(async () => {
  await db.connect()
  await db.query(`SET cella.clock = '2026-10-24'`)
})

after(async () => {
  await db.end()
})

test('only the app\'s core and this feat are migrated', async () => {
  const { rows } = await db.query(`SELECT nspname FROM pg_namespace WHERE nspname IN ('membership', 'transaction', 'expense_membership')`)
  assert.deepEqual(rows, [])
})

test('an expense is numbered, a draft, and comes to its amount and VAT', async () => {
  const { rows } = await db.query(
    `INSERT INTO expense.expense AS e (member, day, label, category, net, vat)
     VALUES ($1, '2026-10-20', 'Train to Clairval', '6251', cella.amount(15000), cella.amount(3000))
     RETURNING e.id, e.status, expense.total(e) AS total`,
    [sofia],
  )
  assert.deepEqual(rows[0], { id: 'ex-0001', status: 'draft', total: '18000' })
})

test('an expense moves only along its lifecycle', async () => {
  await refused(
    () => db.query(`UPDATE expense.expense SET status = 'approved', decided = '2026-10-24', decider = 'hugo@lanterne.example' WHERE id = 'ex-0001'`),
    /ex-0001 is draft, and cannot become approved/,
  )
  await db.query(`UPDATE expense.expense SET status = 'submitted', submitted = '2026-10-24' WHERE id = 'ex-0001'`)
  await refused(() => db.query(`UPDATE expense.expense SET net = cella.amount(25000) WHERE id = 'ex-0001'`), /ex-0001 was submitted: its figures never change/)
  await refused(() => db.query(`UPDATE expense.expense SET status = 'draft' WHERE id = 'ex-0001'`), /ex-0001 is submitted, and cannot become draft/)
})

test('a decision names the expense\'s whole amount, made on the verdict date', async () => {
  await db.query(`UPDATE expense.expense SET status = 'approved', decided = '2026-10-24', decider = 'hugo@lanterne.example' WHERE id = 'ex-0001'`)
  // Outside a write there is no actor, so no decision is this write's.
  assert.equal(await guard('decides', { expense: 'ex-0001', amount: 18000 }), 'ex-0001 was not approved by this write')
  assert.equal(await guard('decides', { expense: 'ex-0099', amount: 1 }), 'no expense ex-0099')
  assert.equal(await guard('reimburses', { expense: 'ex-0001', amount: 18000 }), 'ex-0001 was not reimbursed by this write')
  await db.query(`UPDATE expense.expense SET status = 'reimbursed', reimbursed = '2026-10-24' WHERE id = 'ex-0001'`)
  assert.equal(await guard('reimburses', { expense: 'ex-0001', amount: 18000 }), null)
  assert.equal(await guard('reimburses', { expense: 'ex-0001', amount: 15000 }), 'ex-0001 comes to 18000 cents, not 15000')
})
