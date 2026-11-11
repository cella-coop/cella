// Who reads a worker's part of the work share, as the app role reads it,
// on a database holding only the app's core and this feat: the worker,
// and whoever distributes the surplus; the distribution itself, whoever
// reads its circle.
// The authority is a stub here, in place of core's, which reads seats this
// test does not make. Run by `cella test slice patronage`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const su = new pg.Client()
const app = new pg.Client({ user: 'cella_app' })

const camille = 'camille@lanterne.example'
const chloe = 'chloe@lanterne.example'
const julien = 'julien@lanterne.example'

async function as(actor: string | null, sql: string) {
  await app.query(`SELECT set_config('cella.actor', $1, false)`, [actor ?? ''])
  return (await app.query(sql)).rows
}
const workers = (actor: string | null) => as(actor, `SELECT worker FROM patronage.statement WHERE distribution = 'pd-1990' ORDER BY worker`).then((r) => r.map((x) => x.worker))

before(async () => {
  await su.connect()
  await app.connect()
  await su.query(`SET cella.clock = '2026-06-15'`)
  await su.query('BEGIN')
  await su.query(`INSERT INTO patronage.distribution (id, year, surplus, basis, approved) VALUES ('pd-1990', 1990, cella.amount(1000000), 'salary', '2026-06-15')`)
  await su.query(
    `INSERT INTO patronage.part (distribution, worker, basis, quantity, amount) VALUES
       ('pd-1990', $1, 'salary', 3600000, cella.amount(200000)), ('pd-1990', $2, 'salary', 2880000, cella.amount(160000))`,
    [camille, chloe],
  )
  await su.query('COMMIT')
  await su.query(`CREATE SCHEMA mandate`)
  await su.query(
    `CREATE FUNCTION mandate.may(actor text, power text, cents bigint, about text, day date) RETURNS boolean
     LANGUAGE sql STABLE RETURN actor = '${julien}' AND power = 'distribute-surplus'`,
  )
  await su.query(`GRANT USAGE ON SCHEMA mandate TO cella_app`)
  await su.query(
    `CREATE FUNCTION mandate.covered(actor text, power text, day date) RETURNS text[]
     LANGUAGE sql STABLE RETURN CASE WHEN power = 'read' OR mandate.may(actor, power, NULL, NULL, day) THEN ARRAY(SELECT id FROM circle.circle) ELSE '{}' END`,
  )
  await su.query(`INSERT INTO cella.authority (fn, covered, owner) VALUES ('mandate.may(text, text, bigint, text, date)', 'mandate.covered(text, text, date)', 'test') ON CONFLICT (one) DO UPDATE SET fn = excluded.fn, covered = excluded.covered, owner = excluded.owner`)
})

after(async () => {
  await app.end()
  await su.end()
})

test('a worker reads their own statement; no one signed in, none; the distribution, whoever reads its circle', async () => {
  assert.deepEqual(await workers(chloe), [chloe])
  assert.deepEqual(await workers(null), [])
  assert.deepEqual(await as(chloe, `SELECT id FROM patronage.distribution WHERE id = 'pd-1990'`), [{ id: 'pd-1990' }])
  assert.deepEqual(await as(null, `SELECT id FROM patronage.distribution WHERE id = 'pd-1990'`), [])
})

test('whoever distributes the surplus reads every worker\'s', async () => {
  assert.deepEqual(await workers(julien), [camille, chloe])
})
