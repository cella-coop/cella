// The work share employed in shares, on a database holding the app's
// core, the account, member, patronage and transaction feats, their lower
// grafts and this graft: no trigger credits a distribution, so its entry
// posts its split alone; the credit that follows it, `employing`, buys
// half of an associate's part in whole shares, in an entry of its own,
// and adds them to what the associate holds; a worker who is no associate
// is credited nothing and owed it all; and the guard takes exactly that
// credit, and refuses one posting anything beside 424 and the capital
// account, or a second for the same part. Run by `cella test slice
// account-membership-patronage-transaction`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { employing } from '../src/handlers/employ.ts'

const db = new pg.Client()
const hugo = 'hugo@lanterne.example'

const one = async <R>(sql: string, values: unknown[] = []) => (await db.query(sql, values)).rows[0] as R
const guard = async (fn: string, payload: object) => (await one<{ r: string | null }>(`SELECT ${fn}($1) AS r`, [payload])).r
const employable = async () => (await db.query<{ member: string }>(`SELECT member FROM account_membership_patronage_transaction.employable('2025')`)).rows.map((r) => r.member)
const held = async () => (await one<{ shares: number }>('SELECT shares FROM membership.member WHERE address = $1', [hugo])).shares

// An entry of the distribution's split, as patronage-transaction's handler
// posts it, linked to the distribution.
async function post(): Promise<string> {
  const { rows } = await db.query<{ id: string }>(`INSERT INTO transaction.entry (date, label) VALUES (cella.verdict_date(), 'Distribution') RETURNING id`)
  const entry = rows[0].id
  await db.query(
    `INSERT INTO transaction.line (entry, n, account, side, amount)
     SELECT $1, row_number() OVER (), account, side, cella.amount(cents) FROM patronage_transaction.lines('2025')`,
    [entry],
  )
  await db.query(`INSERT INTO patronage_transaction.distribution (distribution, entry) VALUES ('2025', $1)`, [entry])
  return entry
}

before(async () => {
  await db.connect()
  await db.query(`SET cella.clock = '2026-11-02'`)
  await db.query(
    `INSERT INTO account.account (code, label, kind, cash) VALUES
       ('1013', 'Capital', 'equity', false), ('120', 'Result', 'equity', false), ('424', 'Work share owed', 'liability', false),
       ('1061', 'Legal reserve', 'equity', false), ('512', 'Bank', 'asset', true)`,
  )
  await db.query(`INSERT INTO account.terms (id, "from", share, minimum, instalments, delay, repayments, adopted) VALUES ('t-2021', 2021, cella.amount(5000), 20, 10, 12, 3, '2021-03-01')`)
  await db.query(`INSERT INTO patronage.terms (id, "from", salary, capital, adopted) VALUES ('t-2021', 2021, 100, 50, '2021-03-01')`)
  await db.query(`INSERT INTO account.period (month) VALUES ('2026-11')`)
  await db.query(`WITH person AS (INSERT INTO person.person (address, name) VALUES ($1, 'Hugo Lefèvre') ON CONFLICT DO NOTHING) INSERT INTO membership.member (address, status, since, shares) VALUES ($1, 'active', '2021-03-01', 40)`, [hugo])
  await db.query(`INSERT INTO account.account (code, label, kind, parent, holder) VALUES ('101301', 'Capital — Hugo', 'equity', '1013', $1)`, [hugo])
  // A 2025 surplus whose work share the terms divide by pay, half of an
  // associate's part in shares; its parts stand in for those a basis graft
  // makes when it is approved.
  await db.query(`INSERT INTO patronage.distribution (id, year, surplus, basis) VALUES ('2025', 2025, cella.amount(346912), 'salary')`)
  await db.query(`INSERT INTO patronage.share (distribution, kind, percent, amount) VALUES ('2025', 'work', 50, cella.amount(173456)), ('2025', 'legal', 50, cella.amount(173456))`)
  await db.query(`UPDATE patronage.distribution SET approved = cella.verdict_date() WHERE id = '2025'`)
  await db.query(
    `INSERT INTO patronage.part (distribution, worker, basis, quantity, amount) VALUES
       ('2025', $1, 'salary', 3000000, cella.amount(123456)), ('2025', 'zoe@x', 'salary', 1200000, cella.amount(50000))`,
    [hugo],
  )
  await db.query(`UPDATE patronage.distribution SET distributed = cella.verdict_date() WHERE id = '2025'`)
})

after(async () => {
  await db.end()
})

test('only the app\'s core, the feats it joins and its lower grafts are migrated', async () => {
  const { rows } = await db.query(`SELECT nspname FROM pg_namespace WHERE nspname IN ('motion', 'payslip', 'patronage_payslip') ORDER BY 1`)
  assert.deepEqual(rows, [])
})

test('no trigger credits a distribution: its entry posts the split alone, and Hugo holds what he held', async () => {
  const shares = await held()
  await db.query('BEGIN')
  const entry = await post()
  await db.query('COMMIT')
  assert.equal((await one<{ n: number }>('SELECT count(*)::int AS n FROM transaction.line WHERE entry = $1', [entry])).n, 3)
  assert.equal((await one<{ n: number }>('SELECT count(*)::int AS n FROM account_membership_patronage_transaction.credit')).n, 0)
  assert.equal(await held(), shares)
  assert.equal(await guard('patronage_transaction.posted', { distribution: '2025' }), null)
  assert.deepEqual(await employable(), [hugo], 'a worker who is no associate is credited nothing')
})

test('the credit that follows employs half of Hugo\'s part in whole shares, in an entry of its own, and adds them to what he holds', async () => {
  const shares = await held()
  await db.query('BEGIN')
  const credited = await employing({ distribution: '2025', member: hugo, motion: 'm-1' }).state(db, {} as never)
  assert.deepEqual(
    { ...credited, entry: undefined },
    { distribution: '2025', member: hugo, motion: 'm-1', account: '101301', shares: 12, amount: 600_00, until: '2031-06-01', entry: undefined, holds: shares + 12 },
  )
  const payload = { distribution: '2025', member: hugo, entry: credited.entry }
  assert.equal(await guard('account_membership_patronage_transaction.employs', payload), null)
  await db.query('COMMIT')

  assert.deepEqual((await db.query(`SELECT account, side, cella.cents(amount) AS cents FROM transaction.line WHERE entry = $1 ORDER BY n`, [credited.entry])).rows, [
    { account: '424', side: 'debit', cents: '60000' },
    { account: '101301', side: 'credit', cents: '60000' },
  ])
  assert.deepEqual(await one(`SELECT member, account, shares, cella.cents(amount) AS cents, to_char(until, 'YYYY-MM-DD') AS until, entry FROM account_membership_patronage_transaction.credit`), {
    member: hugo,
    account: '101301',
    shares: 12,
    cents: '60000',
    until: '2031-06-01',
    entry: credited.entry,
  })
  assert.equal(await held(), shares + 12)
  assert.deepEqual(await employable(), [], 'nothing is left to credit')

  await db.query('BEGIN')
  await assert.rejects(employing({ distribution: '2025', member: hugo, motion: 'm-1' }).state(db, {} as never), /hugo@lanterne.example was credited the shares of their part of 2025 already/)
  await db.query('ROLLBACK')
  await db.query('BEGIN')
  await assert.rejects(employing({ distribution: '2025', member: 'zoe@x', motion: 'm-1' }).state(db, {} as never), /zoe@x's part of 2025 buys no shares/)
  await db.query('ROLLBACK')
  assert.equal(await guard('account_membership_patronage_transaction.employs', { distribution: '2025', member: 'zoe@x', entry: credited.entry }), 'zoe@x\'s part of 2025 buys no shares')
  assert.equal(
    await guard('account_membership_patronage_transaction.employs', { distribution: '2025', member: hugo, entry: 'je-9999' }),
    'this write credited hugo@lanterne.example no shares of 2025',
  )
})

test('a credit whose entry posts anything beside 424 and the capital account is refused', async () => {
  await db.query('BEGIN')
  const { rows } = await db.query<{ id: string }>(`INSERT INTO transaction.entry (date, label) VALUES (cella.verdict_date(), 'Forged') RETURNING id`)
  const forged = rows[0].id
  await db.query(
    `INSERT INTO transaction.line (entry, n, account, side, amount) VALUES ($1, 1, '424', 'debit', cella.amount(60000)), ($1, 2, '512', 'credit', cella.amount(60000))`,
    [forged],
  )
  await db.query(`UPDATE account_membership_patronage_transaction.credit SET entry = $1 WHERE member = $2`, [forged, hugo])
  assert.equal(
    await guard('account_membership_patronage_transaction.employs', { distribution: '2025', member: hugo, entry: forged }),
    `${forged} does not post exactly the shares hugo@lanterne.example's part buys: 424 debited and their capital account credited`,
  )
  await db.query('ROLLBACK')
})
