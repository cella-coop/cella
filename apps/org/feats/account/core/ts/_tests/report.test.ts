// The statements' presentation alone, on a database holding only the app's
// core and this feat: each account is placed in one rubric of each sheet
// by its code's longest prefix, every total names rubrics of its own
// sheet, and the spans are drawn from the periods of the books. The
// slice's other tests share the database, so the periods this one writes
// are rolled back after it. Run by `cella test slice account`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()

const rubric = async (sheet: string, code: string) =>
  (await db.query<{ r: string | null }>('SELECT account.rubric_of($1, $2) AS r', [sheet, code])).rows[0].r

before(async () => {
  await db.connect()
})

after(async () => {
  await db.end()
})

test('an account is placed by the longest prefix of its code', async () => {
  const placed = {
    '101301': ['capital', null],
    '1061': ['legal-reserve', null],
    '1068': ['other-reserves', null],
    '120': ['to-allocate', null],
    '411': ['receivables', null],
    '44566': ['other-receivables', null],
    '44571': ['tax-social', null],
    '4562': ['called-capital', null],
    '4567': ['other-debts', null],
    '455': ['other-loans', null],
    '512': ['cash', null],
    '613': ['period-result', 'external'],
    '641': ['period-result', 'wages'],
    '645': ['period-result', 'social'],
    '706': ['period-result', 'production-sold'],
    '707': ['period-result', 'goods-sold'],
  }
  for (const [code, [balance, income]] of Object.entries(placed)) {
    assert.equal(await rubric('balance', code), balance, `${code} on the balance sheet`)
    assert.equal(await rubric('income', code), income, `${code} on the income statement`)
  }
})

test('every account of classes 1 to 7 has a place on the balance sheet, so it balances', async () => {
  for (const code of ['1', '19', '2', '3', '4', '48', '5', '59', '6', '69', '7', '79']) {
    assert.notEqual(await rubric('balance', code), null, code)
  }
})

test('a total adds and subtracts rubrics of its own sheet, and a line names its side', async () => {
  const { rows } = await db.query(
    `SELECT r.id, x.part FROM account.rubric r, unnest(r.adds || r.subtracts) x(part)
     WHERE NOT EXISTS (SELECT FROM account.rubric p WHERE p.id = x.part AND p.sheet = r.sheet AND p.kind <> 'heading')`,
  )
  assert.deepEqual(rows, [])
  await assert.rejects(
    db.query(`INSERT INTO account.rubric (id, sheet, n, kind, label) VALUES ('sideless', 'income', 99, 'line', 'No side')`),
    /check/,
  )
})

test('the spans are each month, quarter and year of the books, against the one before', async () => {
  await db.query('BEGIN')
  try {
    await db.query(`INSERT INTO account.period (month, closed) VALUES ('2026-07', '2026-08-05'), ('2026-08', '2026-09-04'), ('2026-09', '2026-10-05'), ('2026-10', NULL)`)
    const { rows } = await db.query(
      `SELECT id, kind, to_char(since, 'YYYY-MM-DD') AS since, to_char(until, 'YYYY-MM-DD') AS until, before, closed
       FROM account.report WHERE since >= '2026-01-01' ORDER BY until, kind`,
    )
    assert.deepEqual(rows, [
      { id: '2026-07', kind: 'month', since: '2026-07-01', until: '2026-07-31', before: '2026-06', closed: true },
      { id: '2026-08', kind: 'month', since: '2026-08-01', until: '2026-08-31', before: '2026-07', closed: true },
      { id: '2026-09', kind: 'month', since: '2026-09-01', until: '2026-09-30', before: '2026-08', closed: true },
      { id: '2026-Q3', kind: 'quarter', since: '2026-07-01', until: '2026-09-30', before: '2026-Q2', closed: true },
      { id: '2026-10', kind: 'month', since: '2026-10-01', until: '2026-10-31', before: '2026-09', closed: false },
      { id: '2026-Q4', kind: 'quarter', since: '2026-10-01', until: '2026-12-31', before: '2026-Q3', closed: false },
      { id: '2026', kind: 'year', since: '2026-01-01', until: '2026-12-31', before: '2025', closed: false },
    ])
  } finally {
    await db.query('ROLLBACK')
  }
})
