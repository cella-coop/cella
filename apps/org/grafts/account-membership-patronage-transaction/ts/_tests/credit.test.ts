// The work share employed in shares, on a database holding the app's
// core, the account, member, patronage and transaction feats, their lower
// grafts and this graft: distributing a year employs half of an
// associate's part in whole shares, as lines of the distribution's own
// entry, adds them to what the associate holds and pays a worker who is
// no associate it all; the rule takes exactly that entry, and refuses one
// that posts anything beside the split and the shares. Run by `cella test
// slice account-membership-patronage-transaction`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()
const hugo = 'hugo@lanterne.example'

const one = async <R>(sql: string, values: unknown[] = []) => (await db.query(sql, values)).rows[0] as R
const rule = async (fn: string) => (await one<{ r: string | null }>(`SELECT ${fn}($1) AS r`, [{ distribution: '2025' }])).r

// An entry of the distribution's split, as patronage-transaction's handler
// posts it, linked to the distribution in the same transaction, with the
// lines `extra` beside it.
async function post(extra: [string, 'debit' | 'credit', number][] = []): Promise<string> {
  await db.query('BEGIN')
  const { rows } = await db.query<{ id: string }>(`INSERT INTO transaction.entry (date, label) VALUES (cella.verdict_date(), 'Distribution') RETURNING id`)
  const entry = rows[0].id
  await db.query(
    `INSERT INTO transaction.line (entry, n, account, side, amount)
     SELECT $1, row_number() OVER (), account, side, cella.amount(cents) FROM patronage_transaction.lines('2025')`,
    [entry],
  )
  for (const [i, [account, side, cents]] of extra.entries()) {
    await db.query(`INSERT INTO transaction.line (entry, n, account, side, amount) VALUES ($1, $2, $3, $4, cella.amount($5))`, [entry, 10 + i, account, side, cents])
  }
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
  const { rows } = await db.query(`SELECT nspname FROM pg_namespace WHERE nspname IN ('decision', 'payslip', 'patronage_payslip') ORDER BY 1`)
  assert.deepEqual(rows, [])
})

test('an entry beside the split and the shares is refused', async () => {
  const entry = await post([['424', 'debit', 100], ['512', 'credit', 100]])
  await db.query(`INSERT INTO patronage_transaction.distribution (distribution, entry) VALUES ('2025', $1)`, [entry])
  assert.match((await rule('account_membership_patronage_transaction.credited')) ?? '', new RegExp(`${entry} does not post exactly the split of 2025`))
  await db.query('ROLLBACK')
})

test('distributing employs half of an associate\'s part in whole shares, in the distribution\'s entry; a worker who is no associate is paid it all', async () => {
  const shares = (await one<{ shares: number }>('SELECT shares FROM membership.member WHERE address = $1', [hugo])).shares
  const entry = await post()
  await db.query(`INSERT INTO patronage_transaction.distribution (distribution, entry) VALUES ('2025', $1)`, [entry])
  await db.query('COMMIT')

  assert.deepEqual((await db.query(`SELECT n, account, side, cella.cents(amount) AS cents FROM transaction.line WHERE entry = $1 AND n > 3 ORDER BY n`, [entry])).rows, [
    { n: 4, account: '424', side: 'debit', cents: '60000' },
    { n: 5, account: '101301', side: 'credit', cents: '60000' },
  ])
  assert.deepEqual(await one(`SELECT member, account, shares, cella.cents(amount) AS cents, to_char(until, 'YYYY-MM-DD') AS until, entry FROM account_membership_patronage_transaction.credit`), {
    member: hugo,
    account: '101301',
    shares: 12,
    cents: '60000',
    until: '2031-06-01',
    entry,
  })
  assert.equal((await one<{ shares: number }>('SELECT shares FROM membership.member WHERE address = $1', [hugo])).shares, shares + 12)
  assert.equal(await rule('account_membership_patronage_transaction.credited'), null)
  assert.equal(await rule('patronage_transaction.posted'), null)
})
