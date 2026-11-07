// Instalments from pay on a database holding the app's core, the account,
// member, payslip and transaction feats, their lower grafts and this one:
// an associate spreads what they owe on their subscription, no more
// instalments than the statutes allow, counting those withheld already;
// when a run is paid, each instalment due is withheld in its payment's own
// entry, never more than is owed nor in more months than the plan's count,
// and the payment's guards take the lines it adds; and a spread and a
// payment's instalments fold as their entries keep them
// (`sql/004-folds.sql`). Run by `cella test slice
// account-membership-payslip-transaction`.

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

// Stands in for payslip-transaction's pay write, in an open transaction:
// the payment's entry carries the run's own lines, those the grafts above
// registered, `payslip_transaction.added`, and any `extra`; it is linked
// in `posting`, and each graft above keeps what it added.
async function paying(month: string, date: string, extra: [string, string, number][] = []) {
  const { rows } = await db.query<{ id: string }>(`INSERT INTO transaction.entry (date, label) VALUES ($1, $2) RETURNING id`, [date, `Payroll paid, ${month}`])
  const entry = rows[0].id
  await db.query(
    `INSERT INTO transaction.line (entry, n, account, side, amount)
     SELECT $1, row_number() OVER (ORDER BY x.k, x.o), x.account, x.side, cella.amount(x.cents)
     FROM (
       SELECT 1 AS k, l.o, l.account, l.side, l.cents FROM payslip_transaction.lines($2, 'payment') WITH ORDINALITY l (account, side, cents, o)
       UNION ALL SELECT 2, a.o, a.account, a.side, a.cents FROM payslip_transaction.added($2) WITH ORDINALITY a (account, side, cents, o)
       UNION ALL SELECT 3, e.o, e.account, e.side, e.cents FROM ROWS FROM (jsonb_to_recordset($3::jsonb) AS (account text, side text, cents bigint)) WITH ORDINALITY e (account, side, cents, o)
     ) x`,
    [entry, month, JSON.stringify(extra.map(([account, side, cents]) => ({ account, side, cents })))],
  )
  await db.query(`INSERT INTO payslip_transaction.posting (entry, month, event) VALUES ($1, $2, 'payment')`, [entry, month])
  await db.query('SELECT payslip_transaction.keep($1, $2)', [month, entry])
  return entry
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
    `INSERT INTO account.terms (id, policy, "from", share, minimum, instalments, delay, repayments, adopted)
     VALUES ('t-2021', 't-2021', '2021-01-01', cella.amount(5000), 20, 10, 12, 3, '2021-03-01')`,
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
  const { rows } = await db.query(`SELECT nspname FROM pg_namespace WHERE nspname IN ('motion', 'timesheet') ORDER BY 1`)
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
  await db.query(`INSERT INTO account_membership_payslip_transaction.plan (member, instalments, each, since, prior) VALUES ($1, 10, cella.amount(10000), cella.verdict_date(), 0)`, [ines])
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
  const entry = await paying('2026-11', '2026-12-01')
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
  await paying('2026-12', '2026-12-31', [['512', 'credit', 100], ['641', 'debit', 100]])
  assert.match((await guard('payslip_transaction.paid', { month: '2026-12' })) ?? '', /posts more than 2026-12's payment, and not in balance away from its own accounts and the bank/)
  assert.match((await guard('account_membership_payslip_transaction.deducted', { month: '2026-12' })) ?? '', /does not post what 2026-12's pay withheld/)
  await db.query('ROLLBACK')
})

// A month's run paid, in one transaction, as the pay write pays it, which
// withholds what is due.
async function pay(month: string, date: string) {
  await db.query(`SET cella.clock = '${date}'`)
  await db.query('BEGIN')
  await paying(month, date)
  await db.query('COMMIT')
}

const due = async (month: string) => (await db.query(`SELECT member, cents FROM account_membership_payslip_transaction.due($1)`, [month])).rows
const unpaid = async () => Number((await one<{ unpaid: string }>('SELECT unpaid FROM account_membership_transaction.called WHERE member = $1', [ines])).unpaid)

test('spreading again counts the instalment her pay withheld: more than the ceiling has left is refused', async () => {
  assert.equal(
    await guard('account_membership_payslip_transaction.spreads', { member: ines, instalments: 10 }),
    'ines@lanterne.example spreads their subscription over 10 instalments, 1 already withheld from their pay: t-2021 allow at most 10',
  )
  await db.query(`UPDATE account_membership_payslip_transaction.plan SET instalments = 9, each = cella.amount(10000), since = cella.verdict_date() WHERE member = $1`, [ines])
  assert.equal(
    await guard('account_membership_payslip_transaction.spreads', { member: ines, instalments: 9 }),
    'ines@lanterne.example\'s plan was not set by this write: 9 instalments of what they owe, rounded up to the cent',
    'a plan that does not count the instalment withheld before it',
  )
  await db.query(`UPDATE account_membership_payslip_transaction.plan SET prior = 1 WHERE member = $1`, [ines])
  assert.match((await guard('account_membership_payslip_transaction.spreads', { member: ines, instalments: 9 })) ?? '', /may spread only their own subscription/)
})

test('a net pay below her instalment withholds in exactly the plan\'s count of months, the last all her net pay allows, and nothing the month after', async () => {
  await db.query(`INSERT INTO account.period (month) VALUES ('2027-01'), ('2027-02'), ('2027-03')`)
  // Spread again after November: what is left over three instalments of 300 €.
  await db.query(`UPDATE account_membership_payslip_transaction.plan SET instalments = 3, each = cella.amount(30000), prior = 1 WHERE member = $1`, [ines])

  await db.query('BEGIN')
  await db.query(`UPDATE account_membership_payslip_transaction.plan SET instalments = 1 WHERE member = $1`, [ines])
  assert.deepEqual(await due('2026-12'), [{ member: ines, cents: '90000' }], 'a plan\'s last is all she still owes')
  await db.query('ROLLBACK')

  await pay('2026-12', '2026-12-31')
  assert.equal(await guard('account_membership_payslip_transaction.deducted', { month: '2026-12' }), null)
  assert.equal(await unpaid(), 60000)

  // From January she is paid 250 € gross, her net pay below her instalment.
  await db.query(`INSERT INTO payslip.salary (member, "from", gross) VALUES ($1, '2027-01-01', cella.amount(25000))`, [ines])
  await run('2027-01', '2027-01-30', '2027-01-31')
  const net = (await one<{ net: string }>(`SELECT cella.cents(net) AS net FROM payslip.payslip WHERE month = '2027-01' AND member = $1`, [ines])).net
  assert.ok(Number(net) < 30000)
  assert.deepEqual(await due('2027-01'), [{ member: ines, cents: net }], 'the second, within her net pay')
  await pay('2027-01', '2027-01-31')
  assert.equal(await guard('account_membership_payslip_transaction.deducted', { month: '2027-01' }), null)

  await run('2027-02', '2027-02-27', '2027-02-28')
  assert.deepEqual(await due('2027-02'), [{ member: ines, cents: net }], 'the last, all her net pay allows')
  await pay('2027-02', '2027-02-28')
  assert.equal(await guard('account_membership_payslip_transaction.deducted', { month: '2027-02' }), null)
  assert.equal(await unpaid(), 60000 - 2 * Number(net))

  // From March her pay covers what is left, but the plan's three are withheld.
  await db.query(`INSERT INTO payslip.salary (member, "from", gross) VALUES ($1, '2027-03-01', cella.amount(220000))`, [ines])
  await run('2027-03', '2027-03-30', '2027-03-31')
  assert.deepEqual(await due('2027-03'), [], 'the plan withholds nothing more')
  await pay('2027-03', '2027-03-31')
  assert.equal(await guard('account_membership_payslip_transaction.deducted', { month: '2027-03' }), null)
  assert.equal((await one<{ n: string }>(`SELECT count(*) AS n FROM account_membership_payslip_transaction.withheld WHERE month = '2027-03'`)).n, '0')
  assert.equal(await unpaid(), 60000 - 2 * Number(net), 'what is left is still owed, paid in through the bank')
})

test('the graft adds to a run\'s payment by payslip-transaction\'s register, and puts no trigger on its posting', async () => {
  assert.deepEqual((await db.query(`SELECT lines::text, keeps::text, owner FROM payslip_transaction.payment_lines`)).rows, [
    {
      lines: 'account_membership_payslip_transaction.withholds(text)',
      keeps: 'account_membership_payslip_transaction.keeps(text,text)',
      owner: 'account-membership-payslip-transaction',
    },
  ])
  assert.deepEqual((await db.query(`SELECT t.tgname FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid WHERE t.tgrelid = 'payslip_transaction.posting'::regclass AND p.pronamespace = 'account_membership_payslip_transaction'::regnamespace`)).rows, [])
  assert.deepEqual((await db.query(`SELECT * FROM payslip_transaction.added('2027-03')`)).rows, [], 'a month with nothing due adds no line')
})

test('payslip-transaction\'s register calls the functions it holds, never an overload under their names', async () => {
  // The functions registered take the month as varchar; each overload
  // takes the text a call passes, which a call by name alone would prefer.
  await db.query('BEGIN')
  try {
    await db.query(`CREATE SCHEMA extender`)
    await db.query(`CREATE TABLE extender.kept (month text, entry text)`)
    await db.query(
      `CREATE FUNCTION extender.lines(month varchar) RETURNS TABLE (account text, side text, cents bigint)
       LANGUAGE sql STABLE AS $$ VALUES ('4562', 'credit', 1::bigint) $$`,
    )
    await db.query(
      `CREATE FUNCTION extender.lines(month text) RETURNS TABLE (account text, side text, cents bigint)
       LANGUAGE sql STABLE AS $$ VALUES ('666', 'debit', 1::bigint) $$`,
    )
    await db.query(`CREATE FUNCTION extender.keeps(month varchar, entry varchar) RETURNS void LANGUAGE sql AS $$ INSERT INTO extender.kept VALUES (month, entry) $$`)
    await db.query(
      `CREATE FUNCTION extender.keeps(month text, entry text) RETURNS void LANGUAGE plpgsql AS $$
       BEGIN
         RAISE EXCEPTION 'the overload ran';
       END $$`,
    )
    await db.query(`SELECT payslip_transaction.register_payment_lines('extender.lines(varchar)', 'extender.keeps(varchar, varchar)', 'test')`)
    assert.deepEqual((await db.query(`SELECT * FROM payslip_transaction.added('2027-03')`)).rows, [{ account: '4562', side: 'credit', cents: '1' }])
    await db.query(`SELECT payslip_transaction.keep('2027-03', 'je-none')`)
    assert.deepEqual((await db.query(`SELECT * FROM extender.kept`)).rows, [{ month: '2027-03', entry: 'je-none' }])
  } finally {
    await db.query('ROLLBACK')
  }
})

test('a spread folds into her plan, its instalment as its commitment; a payment\'s instalments into what it withheld and paid in', async () => {
  const commitment = { $commit: 'ab'.repeat(32) }
  const entry = (n: number, op: string, payload: unknown) => ({ n, op, actor: ines, date: '2027-01-05', cause: null, payload })
  await db.query('BEGIN')
  const withheld = Number((await one<{ n: string }>('SELECT count(*) AS n FROM account_membership_payslip_transaction.withheld WHERE member = $1', [ines])).n)
  await db.query('SELECT account_membership_payslip_transaction.fold_spread($1)', [entry(1, 'account:capital:spread', { member: ines, instalments: 4, each: commitment })])
  assert.deepEqual(
    await one(`SELECT instalments, each, to_char(since, 'YYYY-MM-DD') AS since, prior FROM account_membership_payslip_transaction.plan WHERE member = $1`, [ines]),
    { instalments: 4, each: null, since: '2027-01-05', prior: withheld },
  )
  assert.equal((await one<{ n: string }>(`SELECT count(*) AS n FROM cella.commitment WHERE field = 'account_membership_payslip_transaction.plan.each' AND subject = $1`, [ines])).n, '1')
  const id = (await one<{ id: string }>(`SELECT 'je-' || lpad((last + 1)::text, 4, '0') AS id FROM transaction.journal`)).id
  await db.query(`INSERT INTO transaction.entry (id, date, label) VALUES ($1, '2027-01-05', 'Payroll paid, 2027-12')`, [id])
  await db.query(
    `INSERT INTO transaction.line (entry, n, account, side, amount) VALUES
       ($1, 1, '512', 'debit', cella.amount(5000)), ($1, 2, '4562', 'credit', cella.amount(5000)),
       ($1, 3, '1012', 'debit', cella.amount(5000)), ($1, 4, '101301', 'credit', cella.amount(5000))`,
    [id],
  )
  await db.query('SELECT account_membership_payslip_transaction.fold_pay($1)', [
    entry(2, 'payslip:run:pay', {
      month: '2027-12',
      entry: id,
      posting: { date: '2027-01-05', label: 'Payroll paid, 2027-12', lines: [{ account: '512', side: 'debit', cents: 5000 }, { account: '4562', side: 'credit', cents: 5000 }, { account: '1012', side: 'debit', cents: 5000 }, { account: '101301', side: 'credit', cents: 5000 }] },
    }),
  ])
  assert.deepEqual(await one(`SELECT member, cella.cents(amount) AS cents, entry FROM account_membership_payslip_transaction.withheld WHERE month = '2027-12'`), { member: ines, cents: '5000', entry: id })
  assert.deepEqual(await one(`SELECT member, cella.cents(amount) AS cents, via FROM account_membership_transaction.paid WHERE entry = $1`, [id]), { member: ines, cents: '5000', via: 'pay' })
  await db.query('ROLLBACK')
})
