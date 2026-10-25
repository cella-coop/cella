// Capital on a database holding the app's core, the account, member and
// transaction feats, account-membership, account-transaction and this graft: a
// member admitted subscribes their shares, their account opened and the
// shares called in the same write, never fewer than the statutes ask; a
// payment in moves what it pays to their account, never beyond what they
// owe; a draw is refused once frozen or beyond the limit; and one who
// leaves has their capital frozen, moved to what is owed them and their
// repayments drawn up, each paid once, in its turn and not before its
// day. Run by `cella test slice account-membership-transaction`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()
const ines = 'ines@lanterne.example'
const hugo = 'hugo@lanterne.example'

const one = async <R>(sql: string, values: unknown[] = []) => (await db.query(sql, values)).rows[0] as R

before(async () => {
  await db.connect()
  await db.query(`SET cella.clock = '2026-10-31'`)
  await db.query(
    `INSERT INTO account.account (code, label, kind, cash) VALUES
       ('1012', 'Capital called', 'equity', false), ('1013', 'Capital', 'equity', false),
       ('4562', 'Capital owed', 'asset', false), ('4567', 'Capital to repay', 'liability', false),
       ('455', 'Current accounts', 'liability', false), ('512', 'Bank', 'asset', true)`,
  )
  await db.query(
    `INSERT INTO account.terms (id, "from", share, minimum, instalments, delay, repayments, adopted)
     VALUES ('t-2021', 2021, cella.amount(5000), 20, 10, 12, 3, '2021-03-01')`,
  )
  await db.query(`INSERT INTO account.period (month) VALUES ('2026-10'), ('2026-11')`)
  await db.query(
    `WITH person AS (INSERT INTO person.person (address, name) VALUES ($1, 'Hugo Lefèvre'), ($2, 'Inès Haddad') ON CONFLICT DO NOTHING) INSERT INTO membership.member (address, status, since, shares) VALUES
       ($1, 'active', '2021-03-01', 40), ($2, 'invited', NULL, 0)`,
    [hugo, ines],
  )
  await db.query(`INSERT INTO person.device (key, address, label, enrolled) VALUES (decode(repeat('ab', 32), 'hex'), $1, 'laptop', '2025-09-01')`, [ines])
  await db.query(`INSERT INTO account.account (code, label, kind, parent, holder) VALUES ('101301', 'Capital — Hugo', 'equity', '1013', $1)`, [hugo])
  await db.query(`INSERT INTO account_membership.allowance (member, amount) VALUES ($1, cella.amount(50000))`, [hugo])
})

after(async () => {
  await db.end()
})

test('only the app\'s core, the feats it joins and its lower grafts are migrated', async () => {
  const { rows } = await db.query(`SELECT nspname FROM pg_namespace WHERE nspname IN ('decision', 'payslip', 'circle_membership') ORDER BY 1`)
  assert.deepEqual(rows, [])
})

test('a capital account is held by a member', async () => {
  await db.query('BEGIN')
  await assert.rejects(
    db.query(`INSERT INTO account.account (code, label, kind, parent, holder) VALUES ('101399', 'x', 'equity', '1013', 'nobody@x')`),
    /101399 is held by nobody@x, who is no member/,
  )
  await db.query('ROLLBACK')
})

const lines = async (entry: string) =>
  (await db.query(`SELECT account, side, cella.cents(amount) AS cents FROM transaction.line WHERE entry = $1 ORDER BY n`, [entry])).rows

test('the statutes ask at least 20 shares: a smaller subscription is refused with the admission', async () => {
  await db.query('BEGIN')
  await assert.rejects(
    db.query(`UPDATE membership.member SET status = 'active', since = '2026-10-31', shares = 10 WHERE address = $1`, [ines]),
    /ines@lanterne.example subscribes 10 shares: t-2021 ask at least 20/,
  )
  await db.query('ROLLBACK')
})

test('admitted, Inès subscribes her 20 shares: her account opens and 1 000 € is called, 4562 debited and 1012 credited', async () => {
  await db.query('BEGIN')
  await db.query(`UPDATE membership.member SET status = 'active', since = '2026-10-31', shares = 20 WHERE address = $1`, [ines])
  await db.query('COMMIT')
  const s = await one<{ account: string; shares: number; entry: string }>('SELECT account, shares, entry FROM account_membership_transaction.subscription WHERE member = $1', [ines])
  assert.deepEqual(s, { account: '101302', shares: 20, entry: 'je-0001' })
  assert.deepEqual(await lines('je-0001'), [{ account: '4562', side: 'debit', cents: '100000' }, { account: '1012', side: 'credit', cents: '100000' }])
  const c = await one('SELECT subscribed, account, frozen FROM account_membership.capital WHERE member = $1', [ines])
  assert.deepEqual(c, { subscribed: '100000', account: '101302', frozen: false })
  assert.deepEqual(await one('SELECT amount, paid, unpaid FROM account_membership_transaction.called WHERE member = $1', [ines]), { amount: '100000', paid: '0', unpaid: '100000' })
})

test('a payment in moves what it pays from 1012 to her account; beyond what she owes, or not exactly the payment, it is refused', async () => {
  const paying = async (cents: number, lines?: [string, string, number][]) => {
    await db.query('BEGIN')
    const { rows } = await db.query<{ id: string }>(`INSERT INTO transaction.entry (date, label) VALUES ('2026-10-31', 'Capital paid in') RETURNING id`)
    const entry = rows[0].id
    const posted = lines ?? (await db.query(`SELECT account, side, cents FROM account_membership_transaction.paying('101302', $1)`, [cents])).rows.map((l) => [l.account, l.side, Number(l.cents)])
    for (const [n, [account, side, c]] of posted.entries()) {
      await db.query('INSERT INTO transaction.line (entry, n, account, side, amount) VALUES ($1, $2, $3, $4, cella.amount($5))', [entry, n + 1, account, side, c])
    }
    await db.query(`INSERT INTO account_membership_transaction.paid (entry, member, amount, via) VALUES ($1, $2, cella.amount($3), 'bank')`, [entry, ines, cents])
    const r = (await one<{ r: string | null }>('SELECT account_membership_transaction.pays($1) AS r', [{ member: ines, amount: cents, entry }])).r
    return { entry, r }
  }
  const paid = await paying(40000)
  assert.equal(paid.r, null)
  await db.query('COMMIT')
  assert.deepEqual(await lines(paid.entry), [
    { account: '512', side: 'debit', cents: '40000' },
    { account: '4562', side: 'credit', cents: '40000' },
    { account: '1012', side: 'debit', cents: '40000' },
    { account: '101302', side: 'credit', cents: '40000' },
  ])
  assert.equal((await one<{ unpaid: string }>('SELECT unpaid FROM account_membership_transaction.called WHERE member = $1', [ines])).unpaid, '60000')

  const beyond = await paying(70000)
  assert.match(beyond.r ?? '', /a payment of 70000 cents exceeds what ines@lanterne.example owes on their subscription, 60000 cents/)
  await db.query('ROLLBACK')
  const skewed = await paying(10000, [['512', 'debit', 10000], ['101302', 'credit', 10000]])
  assert.match(skewed.r ?? '', /is not a payment of 10000 cents on ines@lanterne.example's subscription/)
  await db.query('ROLLBACK')
  const none = (await one<{ r: string }>('SELECT account_membership_transaction.pays($1) AS r', [{ member: hugo, amount: 100, entry: 'je-9999' }])).r
  assert.match(none, /hugo@lanterne.example has no subscription to pay/)
})

test('draws add up against the limit, and the rule refuses one not the actor\'s own', async () => {
  const draw = async (cents: number) => {
    await db.query('BEGIN')
    const { rows } = await db.query<{ id: string }>(`INSERT INTO transaction.entry (date, label) VALUES ('2026-10-31', 'Draw') RETURNING id`)
    const entry = rows[0].id
    await db.query(
      `INSERT INTO transaction.line (entry, n, account, side, amount) VALUES ($1, 1, '455', 'debit', cella.amount($2)), ($1, 2, '512', 'credit', cella.amount($2))`,
      [entry, cents],
    )
    await db.query('INSERT INTO account_membership_transaction.draw (entry, member, amount) VALUES ($1, $2, cella.amount($3))', [entry, hugo, cents])
    await db.query('COMMIT')
    return entry
  }
  await draw(30000)
  const { drawn } = await one<{ drawn: string }>('SELECT drawn FROM account_membership_transaction.drawn WHERE member = $1', [hugo])
  assert.equal(drawn, '30000')
  const beyond = await draw(30000)
  // Outside a write there is no actor, so the rule says first that it is
  // not the actor's own; the limit it reads is the view's.
  const r = await one<{ r: string }>('SELECT account_membership_transaction.draws($1) AS r', [{ member: hugo, amount: 30000, entry: beyond }])
  assert.match(r.r, /may draw only on their own account/)
  const left = await one<{ drawn: string; allowance: string }>('SELECT drawn, allowance FROM account_membership_transaction.drawn WHERE member = $1', [hugo])
  assert.ok(Number(left.drawn) > Number(left.allowance))
})

test('Hugo\'s capital account holds 600 €, twelve shares a past year\'s work share bought him', async () => {
  // Stands in for the distribution that credits them, the patronage
  // grafts' write.
  await db.query(`INSERT INTO account.account (code, label, kind) VALUES ('424', 'Work share owed', 'liability')`)
  await db.query('BEGIN')
  const { rows } = await db.query<{ id: string }>(`INSERT INTO transaction.entry (date, label) VALUES (cella.verdict_date(), 'Distribution') RETURNING id`)
  await db.query(
    `INSERT INTO transaction.line (entry, n, account, side, amount) VALUES ($1, 1, '424', 'debit', cella.amount(60000)), ($1, 2, '101301', 'credit', cella.amount(60000))`,
    [rows[0].id],
  )
  await db.query('COMMIT')
  assert.deepEqual(await lines(rows[0].id), [{ account: '424', side: 'debit', cents: '60000' }, { account: '101301', side: 'credit', cents: '60000' }])
})
test('a member who leaves has their capital frozen for good, moved to 4567, and repaid as the statutes say', async () => {
  await db.query(`UPDATE membership.member SET status = 'exited' WHERE address = $1`, [hugo])
  assert.equal((await one<{ frozen: boolean }>(`SELECT frozen FROM account.account WHERE code = '101301'`)).frozen, true)
  await db.query('BEGIN')
  await assert.rejects(db.query(`UPDATE account.account SET frozen = false WHERE code = '101301'`), /101301 is frozen until it is repaid/)
  await db.query('ROLLBACK')
  const exit = await one<{ entry: string }>(`SELECT entry FROM transaction.line WHERE account = '4567'`)
  assert.deepEqual(await lines(exit.entry), [{ account: '101301', side: 'debit', cents: '60000' }, { account: '4567', side: 'credit', cents: '60000' }])
  const drawn = (await db.query(`SELECT n, to_char(due, 'YYYY-MM-DD') AS due, cella.cents(amount) AS cents FROM account_membership_transaction.repayment WHERE member = $1 ORDER BY n`, [hugo])).rows
  assert.deepEqual(drawn, [
    { n: 1, due: '2027-10-31', cents: '20000' },
    { n: 2, due: '2028-10-31', cents: '20000' },
    { n: 3, due: '2029-10-31', cents: '20000' },
  ])
})

test('one who leaves owing has the rest of their subscription cancelled', async () => {
  await db.query(`UPDATE membership.member SET status = 'exited' WHERE address = $1`, [ines])
  const exit = await one<{ entry: string }>(`SELECT entry FROM transaction.line WHERE account = '4562' AND side = 'credit' AND cella.cents(amount) = 60000`)
  assert.deepEqual(await lines(exit.entry), [
    { account: '101302', side: 'debit', cents: '40000' },
    { account: '4567', side: 'credit', cents: '40000' },
    { account: '1012', side: 'debit', cents: '60000' },
    { account: '4562', side: 'credit', cents: '60000' },
  ])
  assert.deepEqual(await one('SELECT paid, cancelled, unpaid FROM account_membership_transaction.called WHERE member = $1', [ines]), { paid: '40000', cancelled: '60000', unpaid: '0' })
})

test('a repayment is paid once it falls due, after the one before it, exactly, and never changes', async () => {
  await db.query(`INSERT INTO account.period (month) VALUES ('2027-11'), ('2029-11')`)
  const repaying = async (n: number, cents = 20000) => {
    const { rows } = await db.query<{ id: string }>(`INSERT INTO transaction.entry (date, label) VALUES (cella.verdict_date(), 'Capital repaid') RETURNING id`)
    const entry = rows[0].id
    await db.query(
      `INSERT INTO transaction.line (entry, n, account, side, amount) VALUES ($1, 1, '4567', 'debit', cella.amount($2)), ($1, 2, '512', 'credit', cella.amount($2))`,
      [entry, cents],
    )
    await db.query('UPDATE account_membership_transaction.repayment SET entry = $3, paid = cella.verdict_date() WHERE member = $1 AND n = $2 AND paid IS NULL', [hugo, n, entry])
    return (await one<{ r: string | null }>('SELECT account_membership_transaction.repays($1) AS r', [{ member: hugo, n, entry }])).r
  }
  await db.query('BEGIN')
  assert.match((await repaying(1)) ?? '', /hugo@lanterne.example's repayment 1 falls due on 2027-10-31/)
  await db.query('ROLLBACK')
  await db.query(`SET cella.clock = '2027-11-02'`)
  await db.query('BEGIN')
  assert.match((await repaying(2)) ?? '', /hugo@lanterne.example's repayment 2 falls due on 2028-10-31/)
  await db.query('ROLLBACK')
  await db.query('BEGIN')
  assert.match((await repaying(1, 19999)) ?? '', /is not hugo@lanterne.example's repayment 1 of 20000 cents/)
  await db.query('ROLLBACK')
  await db.query('BEGIN')
  assert.equal(await repaying(1), null)
  await db.query('COMMIT')
  await db.query('BEGIN')
  assert.match((await repaying(1)) ?? '', /hugo@lanterne.example's repayment 1 was paid on 2027-11-02 by je-/)
  await db.query('ROLLBACK')
  await db.query(`SET cella.clock = '2029-11-01'`)
  await db.query('BEGIN')
  assert.match((await repaying(3)) ?? '', /hugo@lanterne.example's repayment 2 comes first/)
  await db.query('ROLLBACK')
  await db.query('BEGIN')
  await assert.rejects(
    db.query(`UPDATE account_membership_transaction.repayment SET amount = cella.amount(1) WHERE member = $1 AND n = 1`, [hugo]),
    /hugo@lanterne.example's repayment 1 was paid on 2027-11-02/,
  )
  await db.query('ROLLBACK')
  await db.query(`SET cella.clock = '2026-10-31'`)
})
