// Lanterne's seeded year, including the books and every feat and graft,
// folds from its founding entry into a fresh database, row for row; and a
// personal column a later write cleared reads null on both sides. Run by
// `cella test e2e fold`; the runner folds it a second time after this
// scenario, so the same comparison applies to every other scenario too.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { profile } from '@cella/org-person/api'
import { folded, tables, unfold } from './fold.ts'
import { reader, sign } from './lanterne.ts'

test('Lanterne folds from its founding into a fresh scope, every state table exactly', async () => {
  const db = process.env.PGDATABASE ?? 'cella_test'
  const source = new pg.Client({ database: db })
  await source.connect()
  try {
    const { rows: [head] } = await source.query<{ count: string }>(
      'SELECT count(*) AS count FROM cella.log',
    )
    assert.ok(Number(head.count) > 0, 'the seed has a signed log')
    const { rows: [periods] } = await source.query<{ first: string; last: string }>(
      'SELECT min(month) AS first, max(month) AS last FROM account.period',
    )
    assert.equal(periods.first, '2026-07')
    assert.equal(periods.last, '2026-12')
    const { rows: [first] } = await source.query<{ op: string }>('SELECT op FROM cella.log WHERE n = 1')
    assert.equal(first.op, 'membership-motion:scope:found')
    assert.match(folded(db), /matches .* row for row, state [0-9a-f]+/)
    const [actual, rebuilt] = await Promise.all([tables(db), tables(`${db}_fold`)])
    assert.ok(Object.keys(actual).length > 0, 'the comparison covers state tables')
    assert.deepEqual(rebuilt, actual)
  } finally {
    await source.end()
    await unfold(db)
  }
})

test('Léa gives her email and clears it, and the state hash reads it as null in her scope and in its fold', async () => {
  const db = process.env.PGDATABASE ?? 'cella_test'
  const lea = 'lea@lanterne.example'
  const su = new pg.Client({ database: db })
  await su.connect()
  await su.query(`ALTER ROLE cella_app IN DATABASE ${su.escapeIdentifier(db)} SET cella.clock = '2026-10-24'`)
  const app = new pg.Client({ database: db, user: 'cella_app' })
  await app.connect()
  const as = { db: reader(app, lea), actor: lea, sign: sign(lea) }
  const email = async (on: string) => {
    const c = new pg.Client({ database: on })
    await c.connect()
    try {
      const { rows } = await c.query<{ r: string }>(`SELECT r FROM cella.state_rows(ARRAY['person']) WHERE tab = 'person.person'`)
      const row = rows.map((x) => JSON.parse(x.r)).find((x) => x.address === lea)
      return row?.email
    } finally {
      await c.end()
    }
  }
  try {
    for (const given of ['lea@bernard.example', null]) {
      const out = await profile({ person: lea, email: given }, as)
      assert.equal(out.state, 'settled', out.state === 'refused' ? out.reason : '')
    }
    assert.equal((await su.query('SELECT email FROM person.person WHERE address = $1', [lea])).rows[0].email, null)
    assert.ok((await su.query(`SELECT FROM vault.secret WHERE field = 'person.person.email' AND subject = $1`, [lea])).rowCount, 'the vault keeps the email given before')
    assert.match(folded(db), /matches .* row for row, state [0-9a-f]+/)
    assert.equal(await email(db), null)
    assert.equal(await email(`${db}_fold`), null)
  } finally {
    await app.end()
    await su.end()
    await unfold(db)
  }
})
