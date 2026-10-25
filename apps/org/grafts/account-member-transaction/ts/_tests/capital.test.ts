// Capital on a database holding the app's core, the account, member and
// transaction feats, account-member, account-transaction and this graft: a
// member admitted subscribes their shares, their account opened and the
// subscription posted in the same write; one who leaves has it frozen;
// a draw is refused once frozen or beyond the limit; and an allocation
// employs half of an associate's part of the work share in shares, in its
// own entry, and pays the rest. Run by `cella test slice
// account-member-transaction`.

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
  await db.query(`INSERT INTO account_member.terms (share) VALUES (cella.amount(5000))`)
  await db.query(
    `INSERT INTO account.account (code, label, kind, cash) VALUES
       ('1013', 'Capital', 'equity', false), ('4561', 'Capital owed', 'asset', false),
       ('455', 'Current accounts', 'liability', false), ('512', 'Bank', 'asset', true)`,
  )
  await db.query(`INSERT INTO account.period (month) VALUES ('2026-10')`)
  await db.query(
    `INSERT INTO member.member (address, name, status, since, shares) VALUES
       ($1, 'Hugo Lefèvre', 'active', '2021-03-01', 40), ($2, 'Inès Haddad', 'invited', NULL, 0)`,
    [hugo, ines],
  )
  await db.query(`INSERT INTO account.account (code, label, kind, parent, holder) VALUES ('101301', 'Capital — Hugo', 'equity', '1013', $1)`, [hugo])
  await db.query(`INSERT INTO account_member.allowance (member, amount) VALUES ($1, cella.amount(50000))`, [hugo])
})

after(async () => {
  await db.end()
})

test('only the app\'s core, the feats it joins and its lower grafts are migrated', async () => {
  const { rows } = await db.query(`SELECT nspname FROM pg_namespace WHERE nspname IN ('decision', 'payslip', 'circle_member') ORDER BY 1`)
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

test('admitted, Inès subscribes her 20 shares: her account opens and 1 000 € posts against 4561', async () => {
  await db.query('BEGIN')
  await db.query(`UPDATE member.member SET status = 'active', since = '2026-10-31', shares = 20 WHERE address = $1`, [ines])
  await db.query('COMMIT')
  const s = await one<{ account: string; shares: number; entry: string }>('SELECT account, shares, entry FROM account_member_transaction.subscription WHERE member = $1', [ines])
  assert.deepEqual(s, { account: '101302', shares: 20, entry: 'je-0001' })
  const lines = (await db.query(`SELECT account, side, cella.cents(amount) AS cents FROM transaction.line WHERE entry = 'je-0001' ORDER BY n`)).rows
  assert.deepEqual(lines, [{ account: '4561', side: 'debit', cents: '100000' }, { account: '101302', side: 'credit', cents: '100000' }])
  const c = await one('SELECT subscribed, account, frozen FROM account_member.capital WHERE member = $1', [ines])
  assert.deepEqual(c, { subscribed: '100000', account: '101302', frozen: false })
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
    await db.query('INSERT INTO account_member_transaction.draw (entry, member, amount) VALUES ($1, $2, cella.amount($3))', [entry, hugo, cents])
    await db.query('COMMIT')
    return entry
  }
  await draw(30000)
  const { drawn } = await one<{ drawn: string }>('SELECT drawn FROM account_member_transaction.drawn WHERE member = $1', [hugo])
  assert.equal(drawn, '30000')
  const beyond = await draw(30000)
  // Outside a write there is no actor, so the rule says first that it is
  // not the actor's own; the limit it reads is the view's.
  const r = await one<{ r: string }>('SELECT account_member_transaction.draws($1) AS r', [{ member: hugo, amount: 30000, entry: beyond }])
  assert.match(r.r, /may draw only on their own account/)
  const left = await one<{ drawn: string; allowance: string }>('SELECT drawn, allowance FROM account_member_transaction.drawn WHERE member = $1', [hugo])
  assert.ok(Number(left.drawn) > Number(left.allowance))
})

test('allocating employs half of an associate\'s part in whole shares, in the allocation\'s entry; a worker who is no associate is paid it all', async () => {
  // A 2025 surplus whose work share the terms divide by pay, half of an
  // associate's part in shares; its parts stand in for those a basis graft
  // makes, and its entry for account-transaction's handler.
  await db.query(`INSERT INTO account.account (code, label, kind) VALUES ('120', 'Result', 'equity'), ('424', 'Work share owed', 'liability'), ('1061', 'Legal reserve', 'equity')`)
  await db.query(`INSERT INTO account.terms (id, "from", salary, capital, adopted) VALUES ('t-2021', 2021, 100, 50, '2021-03-01')`)
  await db.query(`INSERT INTO account.allocation (id, year, surplus, basis) VALUES ('al-2025', 2025, cella.amount(346912), 'salary')`)
  await db.query(`INSERT INTO account.share (allocation, kind, percent, amount) VALUES ('al-2025', 'work', 50, cella.amount(173456)), ('al-2025', 'legal', 50, cella.amount(173456))`)
  await db.query(`UPDATE account.allocation SET allocated = cella.verdict_date() WHERE id = 'al-2025'`)
  await db.query(
    `INSERT INTO account.part (allocation, worker, basis, quantity, amount) VALUES
       ('al-2025', $1, 'salary', 3000000, cella.amount(123456)), ('al-2025', 'zoe@x', 'salary', 1200000, cella.amount(50000))`,
    [hugo],
  )
  const owed = (await db.query(`SELECT worker, associate, shares, capital, cash, to_char(until, 'YYYY-MM-DD') AS until FROM account_member.patronage ORDER BY worker`)).rows
  assert.deepEqual(owed, [
    { worker: hugo, associate: true, shares: 12, capital: '60000', cash: '63456', until: '2031-06-01' },
    { worker: 'zoe@x', associate: false, shares: 0, capital: '0', cash: '50000', until: '2031-06-01' },
  ])
  const shares = (await one<{ shares: number }>('SELECT shares FROM member.member WHERE address = $1', [hugo])).shares

  await db.query('BEGIN')
  const { rows } = await db.query<{ id: string }>(`INSERT INTO transaction.entry (date, label) VALUES (cella.verdict_date(), 'Allocation') RETURNING id`)
  const entry = rows[0].id
  await db.query(
    `INSERT INTO transaction.line (entry, n, account, side, amount)
     SELECT $1, row_number() OVER (), account, side, cella.amount(cents) FROM account_transaction.allocation_lines('al-2025')`,
    [entry],
  )
  await db.query(`INSERT INTO account_transaction.allocation (allocation, entry) VALUES ('al-2025', $1)`, [entry])
  await db.query('COMMIT')

  assert.deepEqual((await db.query(`SELECT n, account, side, cella.cents(amount) AS cents FROM transaction.line WHERE entry = $1 AND n > 3 ORDER BY n`, [entry])).rows, [
    { n: 4, account: '424', side: 'debit', cents: '60000' },
    { n: 5, account: '101301', side: 'credit', cents: '60000' },
  ])
  assert.deepEqual(await one(`SELECT member, account, shares, cella.cents(amount) AS cents, entry FROM account_member_transaction.credit`), {
    member: hugo,
    account: '101301',
    shares: 12,
    cents: '60000',
    entry,
  })
  assert.equal((await one<{ shares: number }>('SELECT shares FROM member.member WHERE address = $1', [hugo])).shares, shares + 12)
  const rule = async (fn: string) => (await one<{ r: string | null }>(`SELECT ${fn}($1) AS r`, [{ allocation: 'al-2025' }])).r
  assert.equal(await rule('account_member_transaction.employed'), null)
  assert.equal(await rule('account_transaction.allocated'), null)
})

test('a member who leaves has their capital frozen, for good', async () => {
  await db.query(`UPDATE member.member SET status = 'exited' WHERE address = $1`, [hugo])
  assert.equal((await one<{ frozen: boolean }>(`SELECT frozen FROM account.account WHERE code = '101301'`)).frozen, true)
  await db.query('BEGIN')
  await assert.rejects(db.query(`UPDATE account.account SET frozen = false WHERE code = '101301'`), /101301 is frozen until it is repaid/)
  await db.query('ROLLBACK')
})
