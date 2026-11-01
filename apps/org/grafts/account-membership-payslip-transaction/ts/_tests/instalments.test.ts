// Instalments from pay on a database holding the app's core, the account,
// member, payslip and transaction feats, their lower grafts and this one:
// an associate spreads what they owe on their subscription, no more
// instalments than the statutes allow; when a run is paid, each
// instalment due is withheld in its payment's own entry, never more than
// is owed, and the payment's guards take the lines it adds. Run by `cella
// test slice account-membership-payslip-transaction`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()
const ines = 'ines@lanterne.example'

const one = async <R>(sql: string, values: unknown[] = []) => (await db.query(sql, values)).rows[0] as R
const guard = async (fn: string, payload: object) => (await one<{ r: string | null }>(`SELECT ${fn}($1) AS r`, [payload])).r
const lines = async (entry: string) =>
  (await db.query(`SELECT n, account, side, cella.cents(amount) AS cents FROM transaction.line WHERE entry = $1 ORDER BY n`, [entry])).rows

// A month's run of the payslips its members are due, approved and paid.
async function run(month: string, generated: string, paid: string) {
  await db.query('INSERT INTO payslip.run (month, generated) VALUES ($1, $2)', [month, generated])
  await db.query(
    `INSERT INTO payslip.payslip (month, member, gross, employee, employer, net)
     SELECT $1, d.member, cella.amount(d.gross), cella.amount(d.employee), cella.amount(d.employer), cella.amount(d.net) FROM payslip.due($1) d`,
    [month],
  )
  await db.query(`UPDATE payslip.run SET approved = $2, approver = 'camille@lanterne.example', paid = $2 WHERE month = $1`, [month, paid])
}

before(async () => {
  await db.connect()
  await db.query(`SET cella.clock = '2026-11-30'`)
  await db.query(
    `INSERT INTO account.account (code, label, kind, cash) VALUES
       ('1012', 'Capital called', 'equity', false), ('1013', 'Capital', 'equity', false),
       ('4562', 'Capital owed', 'asset', false), ('421', 'Pay owed', 'liability', false),
       ('431', 'Social funds', 'liability', false), ('512', 'Bank', 'asset', true),
       ('641', 'Pay', 'expense', false), ('645', 'Charges', 'expense', false)`,
  )
  await db.query(
    `INSERT INTO account.terms (id, "from", share, minimum, instalments, delay, repayments, adopted)
     VALUES ('t-2021', 2021, cella.amount(5000), 20, 10, 12, 3, '2021-03-01')`,
  )
  await db.query(`INSERT INTO account.period (month) VALUES ('2026-11'), ('2026-12')`)
  await db.query(`WITH person AS (INSERT INTO person.person (address, name) VALUES ($1, 'Inès Haddad') ON CONFLICT DO NOTHING) INSERT INTO membership.member (address, status, shares) VALUES ($1, 'invited', 0)`, [ines])
  await db.query(`INSERT INTO person.device (key, address, label, enrolled) VALUES (decode(repeat('ab', 32), 'hex'), $1, 'laptop', '2025-09-01')`, [ines])
  await db.query(`UPDATE membership.member SET status = 'active', since = '2026-11-30', shares = 20 WHERE address = $1`, [ines])
  // Stands in for the subscription that follows her admission,
  // account-membership-transaction's write: her account opened and her
  // 20 shares called.
  await db.query(`INSERT INTO account.account (code, label, kind, parent, holder) VALUES ('101301', 'Capital — Inès', 'equity', '1013', $1)`, [ines])
  await db.query('BEGIN')
  const { rows } = await db.query<{ id: string }>(`INSERT INTO transaction.entry (date, label) VALUES (cella.verdict_date(), 'Capital subscribed and called, 101301') RETURNING id`)
  await db.query(
    `INSERT INTO transaction.line (entry, n, account, side, amount) VALUES ($1, 1, '4562', 'debit', cella.amount(100000)), ($1, 2, '1012', 'credit', cella.amount(100000))`,
    [rows[0].id],
  )
  await db.query(
    `INSERT INTO account_membership_transaction.subscription (member, account, shares, entry, amount) VALUES ($1, '101301', 20, $2, cella.amount(100000))`,
    [ines, rows[0].id],
  )
  await db.query('COMMIT')
  await db.query(`INSERT INTO payslip.terms (employee, employer, ratio) VALUES (22, 40, 1.6)`)
  await db.query(`INSERT INTO payslip.salary (member, "from", gross) VALUES ($1, '2026-11-01', cella.amount(220000))`, [ines])
})

after(async () => {
  await db.end()
})

test('only the app\'s core, the feats it joins and its lower grafts are migrated', async () => {
  const { rows } = await db.query(`SELECT nspname FROM pg_namespace WHERE nspname IN ('motion', 'timesheet', 'circle_membership') ORDER BY 1`)
  assert.deepEqual(rows, [])
})

test('Inès spreads her 1 000 € over at most the statutes\' 10 instalments, in a plan only her own write sets', async () => {
  assert.equal((await one<{ unpaid: string }>('SELECT unpaid FROM account_membership_transaction.called WHERE member = $1', [ines])).unpaid, '100000')
  assert.equal(
    await guard('account_membership_payslip_transaction.spreads', { member: ines, instalments: 11 }),
    'ines@lanterne.example spreads their subscription over 11 instalments: t-2021 allow at most 10',
  )
  assert.equal(
    await guard('account_membership_payslip_transaction.spreads', { member: ines, instalments: 10 }),
    'ines@lanterne.example\'s plan was not set by this write: 10 instalments of what they owe, rounded up to the cent',
  )
  await db.query(`INSERT INTO account_membership_payslip_transaction.plan (member, instalments, each, since) VALUES ($1, 10, cella.amount(10000), cella.verdict_date())`, [ines])
  // Outside a write there is no actor, so the guard's last word is whose it is.
  assert.match((await guard('account_membership_payslip_transaction.spreads', { member: ines, instalments: 10 })) ?? '', /may spread only their own subscription/)
  assert.equal(await guard('account_membership_payslip_transaction.spreads', { member: 'nobody@x', instalments: 1 }), 'nobody@x owes nothing on a subscription')
})

test('paying November\'s run withholds one instalment in its own entry: the bank pays her less, and her capital account holds it', async () => {
  await run('2026-11', '2026-11-30', '2026-12-01')
  await db.query(`SET cella.clock = '2026-12-01'`)
  assert.deepEqual((await db.query(`SELECT member, account, cents FROM account_membership_payslip_transaction.due('2026-11')`)).rows, [
    { member: ines, account: '101301', cents: '10000' },
  ])
  await db.query('BEGIN')
  const { rows } = await db.query<{ id: string }>(`INSERT INTO transaction.entry (date, label) VALUES ('2026-12-01', 'Payroll paid, 2026-11') RETURNING id`)
  const entry = rows[0].id
  await db.query(
    `INSERT INTO transaction.line (entry, n, account, side, amount)
     SELECT $1, row_number() OVER (), l.account, l.side, cella.amount(l.cents) FROM payslip_transaction.lines('2026-11', 'payment') l`,
    [entry],
  )
  await db.query(`INSERT INTO payslip_transaction.posting (entry, month, event) VALUES ($1, '2026-11', 'payment')`, [entry])
  await db.query('COMMIT')

  assert.deepEqual((await lines(entry)).slice(3), [
    { n: 4, account: '512', side: 'debit', cents: '10000' },
    { n: 5, account: '4562', side: 'credit', cents: '10000' },
    { n: 6, account: '1012', side: 'debit', cents: '10000' },
    { n: 7, account: '101301', side: 'credit', cents: '10000' },
  ])
  assert.deepEqual(await one(`SELECT via, cella.cents(amount) AS cents FROM account_membership_transaction.paid WHERE entry = $1`, [entry]), { via: 'pay', cents: '10000' })
  assert.equal((await one<{ unpaid: string }>('SELECT unpaid FROM account_membership_transaction.called WHERE member = $1', [ines])).unpaid, '90000')
  assert.equal(await guard('account_membership_payslip_transaction.deducted', { month: '2026-11' }), null)
  assert.equal(await guard('payslip_transaction.paid', { month: '2026-11' }), null)
  const bank = await one<{ b: string }>(
    `SELECT sum(CASE side WHEN 'debit' THEN cella.cents(amount) ELSE -cella.cents(amount) END) AS b FROM transaction.line WHERE entry = $1 AND account = '512'`,
    [entry],
  )
  const net = await one<{ net: string }>(`SELECT cella.cents(net) AS net FROM payslip.payslip WHERE month = '2026-11' AND member = $1`, [ines])
  assert.equal(Number(bank.b), -(Number(net.net) - 10000) - Number((await one<{ c: string }>(`SELECT cents AS c FROM payslip_transaction.lines('2026-11', 'payment') WHERE account = '431'`)).c))

  await db.query('BEGIN')
  await db.query(`DELETE FROM account_membership_payslip_transaction.withheld WHERE month = '2026-11'`)
  assert.equal(await guard('account_membership_payslip_transaction.deducted', { month: '2026-11' }), '2026-11\'s pay does not withhold the instalments its associates owe')
  await db.query('ROLLBACK')
})

test('an instalment is never more than she still owes, and lines that credit the bank are refused by the payment\'s guard', async () => {
  await db.query(`UPDATE account_membership_payslip_transaction.plan SET each = cella.amount(95000) WHERE member = $1`, [ines])
  await run('2026-12', '2026-12-30', '2026-12-31')
  assert.equal((await one<{ cents: string }>(`SELECT cents FROM account_membership_payslip_transaction.due('2026-12')`)).cents, '90000')

  await db.query(`SET cella.clock = '2026-12-31'`)
  await db.query('BEGIN')
  const { rows } = await db.query<{ id: string }>(`INSERT INTO transaction.entry (date, label) VALUES ('2026-12-31', 'Payroll paid, 2026-12') RETURNING id`)
  const entry = rows[0].id
  await db.query(
    `INSERT INTO transaction.line (entry, n, account, side, amount)
     SELECT $1, row_number() OVER (), l.account, l.side, cella.amount(l.cents) FROM payslip_transaction.lines('2026-12', 'payment') l
     UNION ALL SELECT $1, 10, '512', 'credit', cella.amount(100) UNION ALL SELECT $1, 11, '641', 'debit', cella.amount(100)`,
    [entry],
  )
  await db.query(`INSERT INTO payslip_transaction.posting (entry, month, event) VALUES ($1, '2026-12', 'payment')`, [entry])
  assert.match((await guard('payslip_transaction.paid', { month: '2026-12' })) ?? '', /posts more than 2026-12's payment, and not in balance away from its own accounts and the bank/)
  assert.match((await guard('account_membership_payslip_transaction.deducted', { month: '2026-12' })) ?? '', /does not post what 2026-12's pay withheld/)
  await db.query('ROLLBACK')
})
