// Who reads a capital account, as the app role reads it, on a database
// holding only the app's core and this feat: its holder, and whoever holds
// a power that reads capital; every other account, anyone. The authority
// is a stub here, as the membership feat registers the real one. Run by
// `cella test slice account`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const su = new pg.Client()
const app = new pg.Client({ user: 'cella_app' })

const camille = 'camille@lanterne.example'
const chloe = 'chloe@lanterne.example'
const julien = 'julien@lanterne.example'

async function as(actor: string | null) {
  await app.query(`SELECT set_config('cella.actor', $1, false)`, [actor ?? ''])
  return (await app.query(`SELECT code FROM account.account WHERE code LIKE '1013%' ORDER BY code`)).rows.map((r) => r.code)
}

before(async () => {
  await su.connect()
  await app.connect()
  await su.query(
    `INSERT INTO account.account (code, label, kind, parent, holder) VALUES
       ('1013', 'Capital subscribed, called and paid', 'equity', NULL, NULL),
       ('101301', 'Capital — Camille', 'equity', '1013', $1),
       ('101302', 'Capital — Chloé', 'equity', '1013', $2)`,
    [camille, chloe],
  )
  await su.query(`CREATE SCHEMA mandate`)
  await su.query(
    `CREATE FUNCTION mandate.may(actor text, power text, cents bigint, day date) RETURNS boolean
     LANGUAGE sql STABLE RETURN actor = '${julien}' AND power = 'carry-books'`,
  )
  await su.query(`GRANT USAGE ON SCHEMA mandate TO cella_app`)
  await su.query(`INSERT INTO cella.authority (fn, owner) VALUES ('mandate.may(text, text, bigint, date)', 'test')`)
})

after(async () => {
  await app.end()
  await su.end()
})

test('a capital account reads for its holder; the accounts that are no one\'s, for anyone', async () => {
  assert.deepEqual(await as(chloe), ['1013', '101302'])
  assert.deepEqual(await as(camille), ['1013', '101301'])
  assert.deepEqual(await as(null), ['1013'])
})

test('whoever keeps the books reads every capital account', async () => {
  assert.deepEqual(await as(julien), ['1013', '101301', '101302'])
})
