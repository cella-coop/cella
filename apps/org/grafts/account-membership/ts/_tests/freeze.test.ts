// The freeze on a database holding the app's core, the account and member
// feats and this graft: no trigger freezes an exit, so an exit alone
// leaves the capital account open; the account feat's freeze, which
// follows the exit, freezes every account the member holds and no other,
// for good; and this graft's guard refuses it for a member still active.
// Run by `cella test slice account-membership`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { freezing } from '@cella/org-account/api'

const db = new pg.Client()
const hugo = 'hugo@lanterne.example'
const lea = 'lea@lanterne.example'

const one = async <R>(sql: string, values: unknown[] = []) => (await db.query(sql, values)).rows[0] as R
const frozen = async (code: string) => (await one<{ frozen: boolean }>('SELECT frozen FROM account.account WHERE code = $1', [code])).frozen
const guard = async (fn: string, payload: unknown) => (await one<{ r: string | null }>(`SELECT ${fn}($1) AS r`, [payload])).r

before(async () => {
  await db.connect()
  await db.query(`SET cella.clock = '2026-10-31'`)
  await db.query(
    `WITH person AS (INSERT INTO person.person (address, name) VALUES ($1, 'Hugo Lefèvre'), ($2, 'Léa Martin') ON CONFLICT DO NOTHING)
     INSERT INTO membership.member (address, status, since, shares) VALUES ($1, 'active', '2021-03-01', 40), ($2, 'active', '2022-01-01', 20)`,
    [hugo, lea],
  )
  await db.query(`INSERT INTO account.account (code, label, kind, cash) VALUES ('1013', 'Capital', 'equity', false)`)
  await db.query(
    `INSERT INTO account.account (code, label, kind, parent, holder) VALUES
       ('101301', 'Capital — Hugo', 'equity', '1013', $1), ('101302', 'Capital — Léa', 'equity', '1013', $2)`,
    [hugo, lea],
  )
})

after(async () => {
  await db.end()
})

test('only the app\'s core and the feats it joins are migrated', async () => {
  const { rows } = await db.query(`SELECT nspname FROM pg_namespace WHERE nspname IN ('motion', 'transaction', 'account_membership_transaction') ORDER BY 1`)
  assert.deepEqual(rows, [])
})

test('the capital of a member still active is not frozen', async () => {
  assert.match((await guard('account_membership.freezes', { holder: hugo, accounts: ['101301'] })) ?? '', /hugo@lanterne.example is active: only the capital of a member who left is frozen/)
  assert.match((await guard('account_membership.freezes', { holder: 'no@lanterne.example', accounts: [] })) ?? '', /no@lanterne.example is no member/)
})

test('no trigger freezes an exit: Hugo left, and his account stays open until the freeze', async () => {
  await db.query(`UPDATE membership.member SET status = 'exited', exited = '2026-10-31' WHERE address = $1`, [hugo])
  assert.equal(await frozen('101301'), false)
  assert.equal((await one<{ u: boolean }>('SELECT account_membership.unfrozen($1) AS u', [hugo])).u, true)
})

test('the freeze that follows freezes every account he holds and no other, for good', async () => {
  await db.query('BEGIN')
  const accounts = await freezing(db, hugo)
  assert.deepEqual(accounts, ['101301'])
  assert.equal(await guard('account.freezes', { holder: hugo, accounts }), null)
  assert.equal(await guard('account_membership.freezes', { holder: hugo, accounts }), null)
  assert.match((await guard('account.freezes', { holder: hugo, accounts: ['101301', '101302'] })) ?? '', /the freeze names other accounts than those hugo@lanterne.example holds/)
  assert.match((await guard('account.freezes', { holder: lea, accounts: [] })) ?? '', /101302, held by lea@lanterne.example, is not frozen/)
  await db.query('COMMIT')
  assert.equal(await frozen('101301'), true)
  assert.equal(await frozen('101302'), false, 'Léa\'s stays open')
  assert.equal((await one<{ u: boolean }>('SELECT account_membership.unfrozen($1) AS u', [hugo])).u, false, 'nothing is left to freeze')
  await db.query('BEGIN')
  await assert.rejects(db.query(`UPDATE account.account SET frozen = false WHERE code = '101301'`), /101301 is frozen until it is repaid/)
  await db.query('ROLLBACK')
})
