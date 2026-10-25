// The record of imports alone, on a database holding only the app's core
// and this feat: a run recorded as the importer on the verdict date, its
// lines counted as settled or refused, and `import.records` refusing a
// run that is not the one its write names. Run by `cella test slice
// import`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import type { Deps } from '@cella/org-db'
import { fixture, signer } from '@cella/org-sign'
import { record, run, runs } from '../src/api/index.ts'

const db = new pg.Client()
const scope = 'test.example'
const camille = 'camille@test.example'
const as: Deps = { db, actor: camille, sign: signer(scope, camille, fixture(camille, 'laptop')) }

before(async () => {
  await db.connect()
  await db.query(`SET cella.clock = '2026-10-24'`)
  await db.query(`SET cella.scope = '${scope}'`)
  await db.query(`CREATE FUNCTION public.anyone(actor text, device bytea) RETURNS text LANGUAGE sql STABLE RETURN NULL`)
  await db.query(`INSERT INTO cella.keyring (fn, owner) VALUES ('public.anyone(text, bytea)', 'test')`)
})

after(async () => {
  await db.end()
})

test('a run is recorded as its importer on the day, its lines counted', async () => {
  const lines = [
    { line: 2, label: 'ana@test.example', op: 'member:member:invite', state: 'settled' as const, entry: 4 },
    { line: 3, label: 'line 3', op: 'member:member:invite', state: 'failed' as const, reason: 'a member needs an address and a name' },
    { line: 4, label: 'bo@test.example', op: 'member:member:invite', state: 'refused' as const, reason: 'no device' },
  ]
  const out = await record({ kind: 'members', name: 'members.csv', dry: true, lines }, as)
  assert.equal(out.state, 'settled', out.state === 'refused' ? out.reason : '')
  const r = await run(db, 'im-0001')
  assert.deepEqual({ kind: r?.kind, actor: r?.actor, day: r?.day, dry: r?.dry, settled: r?.settled, refused: r?.refused }, {
    kind: 'members', actor: camille, day: '2026-10-24', dry: true, settled: 1, refused: 2,
  })
  assert.deepEqual(r?.lines.map((l) => l.state), ['settled', 'failed', 'refused'])
  assert.equal((await runs(db)).length, 1)
})

test('the counts hold the lines, and the rule refuses a run the write does not name', async () => {
  await db.query('BEGIN')
  try {
    await assert.rejects(
      db.query(`INSERT INTO import.run (kind, name, actor, day, dry, settled, refused, lines) VALUES ('members', 'x.csv', $1, '2026-10-24', true, 2, 0, '[]')`, [camille]),
      /run_check/,
    )
  } finally {
    await db.query('ROLLBACK')
  }
  const rule = async (payload: object) => (await db.query<{ r: string | null }>('SELECT import.records($1) AS r', [payload])).rows[0].r
  assert.match((await rule({ run: 'im-0009' })) ?? '', /no run im-0009/)
  // Outside a write no one acts, so no run was recorded by it.
  assert.match((await rule({ run: 'im-0001', kind: 'members', dry: true, settled: 1, refused: 2 })) ?? '', /im-0001 was not recorded by this write/)
})
