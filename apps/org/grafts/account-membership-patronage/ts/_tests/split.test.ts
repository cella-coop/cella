// Each part split between shares and cash, on a database holding the
// app's core, the account, member and patronage feats, account-membership and
// this graft: an associate's part buys whole shares at the share's value,
// as many as the terms' percent of it buys, blocked five years from the
// first of June after the year; a worker who is no associate, or whose
// capital is frozen, is paid it all. Run by `cella test slice
// account-membership-patronage`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()
const rows = async <R>(sql: string, values: unknown[] = []) => (await db.query(sql, values)).rows as R[]

before(async () => {
  await db.connect()
  await db.query(`SET cella.clock = '2026-11-02'`)
  await db.query(`INSERT INTO account.terms (id, policy, "from", share, minimum, instalments, delay, repayments, adopted) VALUES ('st', 'st', '2021-01-01', cella.amount(5000), 1, 10, 12, 3, '2021-03-01')`)
  await db.query(`INSERT INTO patronage.terms (id, policy, "from", salary, capital, adopted) VALUES ('st', 'st', 2021, 100, 50, '2021-03-01')`)
  await db.query(
    `WITH person AS (INSERT INTO person.person (address, name) VALUES ('ana@x', 'Ana'), ('ben@x', 'Ben') ON CONFLICT DO NOTHING) INSERT INTO membership.member (address, status, shares) VALUES ('ana@x', 'active', 20), ('ben@x', 'active', 20)`,
  )
  await db.query(
    `INSERT INTO account.account (code, label, kind, parent, holder, frozen) VALUES
       ('1013', 'Capital', 'equity', NULL, NULL, false),
       ('101301', 'Capital Ana', 'equity', '1013', 'ana@x', false),
       ('101302', 'Capital Ben', 'equity', '1013', 'ben@x', true)`,
  )
  await db.query(`INSERT INTO patronage.distribution (id, year, surplus, basis) VALUES ('2025', 2025, cella.amount(1000000), 'salary')`)
  await db.query(`INSERT INTO patronage.share (distribution, kind, percent, amount) VALUES ('2025', 'work', 50, cella.amount(500000)), ('2025', 'legal', 50, cella.amount(500000))`)
  await db.query(`UPDATE patronage.distribution SET approved = cella.verdict_date() WHERE id = '2025'`)
  await db.query(
    `INSERT INTO patronage.part (distribution, worker, basis, quantity, amount) VALUES
       ('2025', 'ana@x', 'salary', 3000000, cella.amount(300990)), ('2025', 'ben@x', 'salary', 1000000, cella.amount(100000)),
       ('2025', 'cleo@x', 'salary', 1000000, cella.amount(99010))`,
  )
})

after(async () => {
  await db.end()
})

test('only the app\'s core, the account, member and patronage feats, account-membership and this graft are migrated', async () => {
  assert.deepEqual(await rows(`SELECT nspname FROM pg_namespace WHERE nspname IN ('transaction', 'payslip', 'account_membership_transaction', 'patronage_transaction')`), [])
})

test('an associate\'s part buys whole shares, the rest paid; one frozen, or no associate, is paid it all', async () => {
  assert.deepEqual(
    await rows(`SELECT worker, part, associate, shares, capital, cash, to_char(until, 'YYYY-MM-DD') AS until FROM account_membership_patronage.split ORDER BY worker`),
    [
      { worker: 'ana@x', part: '300990', associate: true, shares: 30, capital: '150000', cash: '150990', until: '2031-06-01' },
      { worker: 'ben@x', part: '100000', associate: false, shares: 0, capital: '0', cash: '100000', until: '2031-06-01' },
      { worker: 'cleo@x', part: '99010', associate: false, shares: 0, capital: '0', cash: '99010', until: '2031-06-01' },
    ],
  )
})
