// Lanterne's seeded year, including the books and every feat and graft,
// folds from its founding entry into a fresh database, row for row. Run
// by `cella test e2e fold`; the runner folds it a second time after this
// scenario, so the same comparison applies to every other scenario too.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { folded, tables, unfold } from './fold.ts'

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
