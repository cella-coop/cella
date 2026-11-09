// Capital on a database holding the app's core, the account, member and
// transaction feats, account-membership, account-transaction and this graft: no
// trigger subscribes an admission or withdraws an exit; a member admitted
// subscribes their shares by the write that follows, their account opened
// and the shares called, never fewer than the statutes ask nor into a
// closed month; a payment in moves what it pays to their account, never
// beyond what they owe; a draw is refused beyond the limit; and one who
// leaves has their capital withdrawn by the write that follows the exit,
// moved to what is owed them and their repayments drawn up on the terms
// of the day they exited, once, each paid once, in its turn and not
// before its day; and each write folds into the rows it wrote
// (`sql/006-folds.sql`). Run by `cella test slice
// account-membership-transaction`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import type { Write } from '@cella/org-db'
import { freezing } from '@cella/org-account/api'
import { subscribing, withdrawing } from '@cella/org-graft-account-membership-transaction/api'

const db = new pg.Client()
const ines = 'ines@lanterne.example'
const hugo = 'hugo@lanterne.example'

const one = async <R>(sql: string, values: unknown[] = []) => (await db.query(sql, values)).rows[0] as R
// What a payload holds of an amount: its commitment, so the guards read the
// amount from the row the write made.
const commitment = { $commit: '00'.repeat(32) }
// A write's state, then its guard on the payload it submits, as the
// notary would judge it, in one transaction left open for the test.
// The slice's tests write below the notary, so no device signs.
async function judged<T>(w: Write<T>, guard: string) {
  await db.query('BEGIN')
  const value = await w.state(db, {} as never)
  const { r } = await one<{ r: string | null }>(`SELECT ${guard}($1) AS r`, [w.payload(value)])
  return { value, r }
}

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
    `INSERT INTO account.terms (id, policy, "from", share, minimum, instalments, delay, repayments, adopted)
     VALUES ('t-2021', 't-2021', '2021-01-01', cella.amount(5000), 20, 10, 12, 3, '2021-03-01')`,
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
  const { rows } = await db.query(`SELECT nspname FROM pg_namespace WHERE nspname IN ('motion', 'payslip') ORDER BY 1`)
  assert.deepEqual(rows, [])
})

const lines = async (entry: string) =>
  (await db.query(`SELECT account, side, cella.cents(amount) AS cents FROM transaction.line WHERE entry = $1 ORDER BY n`, [entry])).rows

test('no trigger subscribes an admission: admitted alone, Inès holds no account and owes nothing', async () => {
  await db.query('BEGIN')
  await db.query(`UPDATE membership.member SET status = 'active', since = '2026-10-31', shares = 20 WHERE address = $1`, [ines])
  assert.equal((await one<{ n: string }>('SELECT count(*) AS n FROM account_membership_transaction.subscription')).n, '0')
  assert.equal((await one<{ n: string }>(`SELECT count(*) AS n FROM account.account WHERE holder = $1`, [ines])).n, '0')
  await db.query('ROLLBACK')
})

test('the statutes ask at least 20 shares, and nothing posts into a closed month: either subscription writes nothing and is refused, saying what would fix it and naming no one', async () => {
  await db.query('BEGIN')
  await db.query(`UPDATE membership.member SET status = 'active', since = '2026-10-31', shares = 10 WHERE address = $1`, [ines])
  await db.query('SAVEPOINT admitted')
  const fewer = await judged(subscribing({ member: ines, motion: 'm-2026-012' }), 'account_membership_transaction.subscribes')
  assert.equal(fewer.r, '10 shares are fewer than the 20 the capital\'s terms ask, by t-2021: ask at least 20 shares')
  assert.equal(fewer.value.entry, '', 'nothing is written')
  await db.query('ROLLBACK TO SAVEPOINT admitted')
  await db.query(`UPDATE membership.member SET shares = 20 WHERE address = $1`, [ines])
  await db.query(`UPDATE account.period SET closed = '2026-10-31' WHERE month = '2026-10'`)
  const closed = await judged(subscribing({ member: ines, motion: 'm-2026-012' }), 'account_membership_transaction.subscribes')
  assert.equal(closed.r, '2026-10 is closed, so nothing subscribed on 2026-10-31 posts into it: the first open month is 2026-11')
  assert.equal((await one<{ n: string }>('SELECT count(*) AS n FROM transaction.entry')).n, '0', 'nothing is written')
  await db.query('ROLLBACK')
})

test('admitted, Inès subscribes her 20 shares by the write that follows: her account opens and 1 000 € is called, 4562 debited and 1012 credited', async () => {
  await db.query(`UPDATE membership.member SET status = 'active', since = '2026-10-31', shares = 20 WHERE address = $1`, [ines])
  const w = subscribing({ member: ines, motion: 'm-2026-012' })
  const { value, r } = await judged(w, 'account_membership_transaction.subscribes')
  assert.equal(r, null)
  await db.query('COMMIT')
  assert.deepEqual({ ...w.payload(value) }, {
    member: ines,
    account: '101302',
    shares: 20,
    amount: 100000,
    entry: 'je-0001',
    motion: 'm-2026-012',
    posting: { date: '2026-10-31', label: 'Capital subscribed and called, 101302', lines: [{ account: '4562', side: 'debit', cents: 100000 }, { account: '1012', side: 'credit', cents: 100000 }] },
    label: { $personal: { field: 'account.account.label', subject: ines, value: 'Capital — Inès Haddad' } },
  })
  const s = await one<{ account: string; shares: number; entry: string }>('SELECT account, shares, entry FROM account_membership_transaction.subscription WHERE member = $1', [ines])
  assert.deepEqual(s, { account: '101302', shares: 20, entry: 'je-0001' })
  assert.deepEqual(await lines('je-0001'), [{ account: '4562', side: 'debit', cents: '100000' }, { account: '1012', side: 'credit', cents: '100000' }])
  const c = await one('SELECT subscribed, account, frozen FROM account_membership.capital WHERE member = $1', [ines])
  assert.deepEqual(c, { subscribed: '100000', account: '101302', frozen: false })
  assert.deepEqual(await one('SELECT amount, paid, unpaid FROM account_membership_transaction.called WHERE member = $1', [ines]), { amount: '100000', paid: '0', unpaid: '100000' })
  const again = await one<{ r: string }>('SELECT account_membership_transaction.subscribes($1) AS r', [{ member: ines, account: '101303', entry: 'je-0002' }])
  assert.equal(again.r, 'je-0002 is not the member\'s subscription')
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
    const r = (await one<{ r: string | null }>('SELECT account_membership_transaction.pays($1) AS r', [{ member: ines, amount: commitment, entry }])).r
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
  const none = (await one<{ r: string }>('SELECT account_membership_transaction.pays($1) AS r', [{ member: hugo, amount: commitment, entry: 'je-9999' }])).r
  assert.match(none, /hugo@lanterne.example has no subscription to pay/)
})

test('draws add up against the limit, and the guard refuses one not the actor\'s own', async () => {
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
  // Outside a write there is no actor, so the guard says first that it is
  // not the actor's own; the limit it reads is the view's.
  const r = await one<{ r: string }>('SELECT account_membership_transaction.draws($1) AS r', [{ member: hugo, amount: commitment, entry: beyond }])
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
test('a member who leaves has their capital withdrawn by the write that follows: moved to 4567, and repaid as the statutes say', async () => {
  await db.query(`UPDATE membership.member SET status = 'exited', exited = cella.verdict_date(), exit = 'excluded' WHERE address = $1`, [hugo])
  assert.equal((await one<{ frozen: boolean }>(`SELECT frozen FROM account.account WHERE code = '101301'`)).frozen, false, 'no trigger freezes an exit')
  assert.equal((await one<{ n: string }>(`SELECT count(*) AS n FROM transaction.line WHERE account = '4567'`)).n, '0', 'nor withdraws it')
  await db.query('BEGIN')
  assert.deepEqual(await freezing(db, hugo), ['101301'])
  await db.query('COMMIT')
  await db.query('BEGIN')
  await assert.rejects(db.query(`UPDATE account.account SET frozen = false WHERE code = '101301'`), /101301 is frozen until it is repaid/)
  await db.query('ROLLBACK')
  const { value, r } = await judged(withdrawing({ member: hugo, motion: 'm-2026-013' }), 'account_membership_transaction.withdraws')
  assert.equal(r, null)
  await db.query('COMMIT')
  assert.deepEqual({ owed: value.owed, cancelled: value.cancelled, repayments: value.repayments }, { owed: 60000, cancelled: 0, repayments: 3 })
  assert.deepEqual(await lines(value.entry), [{ account: '101301', side: 'debit', cents: '60000' }, { account: '4567', side: 'credit', cents: '60000' }])
  const drawn = (await db.query(`SELECT n, to_char(due, 'YYYY-MM-DD') AS due, cella.cents(amount) AS cents FROM account_membership_transaction.repayment WHERE member = $1 ORDER BY n`, [hugo])).rows
  assert.deepEqual(drawn, [
    { n: 1, due: '2027-10-31', cents: '20000' },
    { n: 2, due: '2028-10-31', cents: '20000' },
    { n: 3, due: '2029-10-31', cents: '20000' },
  ])
  const again = await one<{ r: string }>('SELECT account_membership_transaction.withdraws($1) AS r', [{ member: hugo, entry: 'je-9999' }])
  assert.match(again.r, /je-9999 is not hugo@lanterne.example's withdrawal/)
  assert.equal((await one<{ holds: boolean }>('SELECT account_membership_transaction.holds($1) AS holds', [hugo])).holds, false, 'nothing is left to withdraw')
})

test('one who leaves owing has the rest of their subscription cancelled, repaid on the terms of the day they exited; one still a member withdraws nothing', async () => {
  const active = await one<{ r: string }>('SELECT account_membership_transaction.withdraws($1) AS r', [{ member: ines, entry: 'je-9999' }])
  assert.match(active.r, /ines@lanterne.example is active: only the capital of a member who left is withdrawn/)
  // She exits on 15 October, and terms of two repayments are adopted
  // after it, before her withdrawal settles.
  await db.query(`UPDATE membership.member SET status = 'exited', exited = '2026-10-15', exit = 'excluded' WHERE address = $1`, [ines])
  await db.query(
    `INSERT INTO account.terms (id, policy, "from", share, minimum, instalments, delay, repayments, adopted)
     VALUES ('t-2026', 't-2026', '2026-10-20', cella.amount(5000), 20, 10, 6, 2, '2026-10-20')`,
  )
  const { value, r } = await judged(withdrawing({ member: ines, motion: 'm-2026-014' }), 'account_membership_transaction.withdraws')
  assert.equal(r, null)
  await db.query('COMMIT')
  const drawn = (await db.query(`SELECT n, to_char(due, 'YYYY-MM-DD') AS due FROM account_membership_transaction.repayment WHERE member = $1 ORDER BY n`, [ines])).rows
  assert.deepEqual(drawn, [
    { n: 1, due: '2027-10-15' },
    { n: 2, due: '2028-10-15' },
    { n: 3, due: '2029-10-15' },
  ], 'the three of the terms governing her exit, not the two adopted since')
  assert.deepEqual(await lines(value.entry), [
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

// The rows of the tables named, as JSON text, sorted, each without the
// columns named beside it: a personal one, which a fold writes as erasure
// leaves it, a person's line's amount among them, and a journal entry's
// receipt, which it reads from the log.
const shown = {
  'account.account': ['label'],
  'transaction.entry': ['receipt'],
  'transaction.line': ['amount'],
  'transaction.journal': [],
  'account_membership_transaction.subscription': ['cancelled'],
  'account_membership_transaction.paid': ['amount'],
  'account_membership_transaction.draw': ['amount'],
  'account_membership_transaction.repayment': [],
  'account_membership_transaction.withdrawal': [],
}
async function state(): Promise<string[]> {
  const out: string[] = []
  for (const [t, without] of Object.entries(shown)) {
    const { rows } = await db.query<{ r: string }>(`SELECT (to_jsonb(x) - $1::text[])::text AS r FROM ${t} x ORDER BY 1`, [without])
    out.push(...rows.map((x) => `${t} ${x.r}`))
  }
  return out
}
// A payload as the log keeps it: each personal value its commitment.
const logged = (v: unknown) => JSON.parse(JSON.stringify(v), (_, x) => (x && typeof x === 'object' && '$personal' in x ? commitment : x))
const entry = (n: number, op: string, payload: unknown) => ({ n, op, actor: hugo, date: '2026-10-31', cause: null, payload })

// The write's state, then, in its place, its payload folded by `fold`:
// both leave the same rows, and the fold's stay where `keep` says.
async function folds<T>(w: Write<T>, fold: string, keep = false) {
  await db.query('BEGIN')
  const payload = logged(w.payload(await w.state(db, {} as never)))
  const written = await state()
  await db.query('ROLLBACK')
  await db.query('BEGIN')
  await db.query(`SELECT ${fold}($1)`, [entry(1, w.op, payload)])
  assert.deepEqual(await state(), written)
  await db.query(keep ? 'COMMIT' : 'ROLLBACK')
  return payload
}

test('a subscription and a withdrawal fold into the rows each wrote; a payment in, a draw and a repayment as their entries keep them', async () => {
  const lou = 'lou@lanterne.example'
  await db.query(`INSERT INTO person.person (address, name) VALUES ($1, 'Lou Martin')`, [lou])
  await db.query(`INSERT INTO membership.member (address, status, since, shares) VALUES ($1, 'active', '2026-10-31', 20)`, [lou])
  const subscribed = await folds(subscribing({ member: lou, motion: 'm-2026-020' }), 'account_membership_transaction.fold_subscribe', true)
  assert.deepEqual(await one('SELECT label FROM account.account WHERE code = $1', [subscribed.account]), { label: 'redacted' }, 'the label names her: the fold keeps its commitment')
  assert.equal((await one<{ n: string }>(`SELECT count(*) AS n FROM cella.commitment WHERE field = 'account.account.label' AND subject = $1`, [lou])).n, '1')

  const next = async () => (await one<{ id: string }>(`SELECT 'je-' || lpad((last + 1)::text, 4, '0') AS id FROM transaction.journal`)).id
  const posting = (lines: [string, string, number][]) => ({ date: '2026-10-31', label: 'folded', lines: lines.map(([account, side, cents]) => ({ account, side, cents })) })
  await db.query('BEGIN')
  const paid = await next()
  await db.query('SELECT account_membership_transaction.fold_pay($1)', [
    entry(2, 'account:capital:pay', { member: lou, amount: commitment, entry: paid, posting: posting([['512', 'debit', 400_00], ['4562', 'credit', 400_00], ['1012', 'debit', 400_00], [subscribed.account, 'credit', 400_00]]) }),
  ])
  assert.deepEqual(await one('SELECT amount, via FROM account_membership_transaction.paid WHERE entry = $1', [paid]), { amount: null, via: 'bank' })
  const drawn = await next()
  await db.query('SELECT account_membership_transaction.fold_draw($1)', [entry(3, 'account:account:draw', { member: lou, amount: commitment, entry: drawn, posting: { date: '2026-10-31', label: 'folded', lines: [{ account: '455', side: 'debit', cents: commitment, person: lou }, { account: '512', side: 'credit', cents: commitment, person: lou }] } })])
  assert.deepEqual(await one('SELECT member, amount FROM account_membership_transaction.draw WHERE entry = $1', [drawn]), { member: lou, amount: null })
  assert.deepEqual(
    (await db.query('SELECT account, amount, person FROM transaction.line WHERE entry = $1 ORDER BY n', [drawn])).rows,
    [{ account: '455', amount: null, person: lou }, { account: '512', amount: null, person: lou }],
    'a draw\'s lines are hers: each folds with no amount, its commitment applied',
  )
  const repaid = await next()
  await db.query('SELECT account_membership_transaction.fold_repay($1)', [entry(4, 'account:capital:repay', { member: hugo, n: 2, amount: 20000, entry: repaid, posting: posting([['4567', 'debit', 200_00], ['512', 'credit', 200_00]]) })])
  assert.deepEqual(await one(`SELECT entry, to_char(paid, 'YYYY-MM-DD') AS paid FROM account_membership_transaction.repayment WHERE member = $1 AND n = 2`, [hugo]), { entry: repaid, paid: '2026-10-31' })
  await assert.rejects(db.query('SELECT account_membership_transaction.fold_draw($1)', [entry(5, 'account:account:draw', { member: lou, amount: commitment, entry: 'je-9999' })]), /entry 5 keeps no posting/)
  await db.query('ROLLBACK')

  await db.query(`UPDATE membership.member SET status = 'exited', exited = '2026-10-31', exit = 'withdrew' WHERE address = $1`, [lou])
  const withdrawn = await folds(withdrawing({ member: lou }, 'account:own:withdraw'), 'account_membership_transaction.fold_withdraw')
  assert.deepEqual(
    { owed: withdrawn.owed, cancelled: withdrawn.cancelled, repayments: withdrawn.repayments, lines: withdrawn.posting.lines },
    {
      owed: undefined,
      cancelled: commitment,
      repayments: [],
      lines: [
        { account: '1012', side: 'debit', cents: commitment, person: lou },
        { account: '4562', side: 'credit', cents: commitment, person: lou },
      ],
    },
    'what she had not paid is hers: the log keeps no figure of it in plain',
  )
})
