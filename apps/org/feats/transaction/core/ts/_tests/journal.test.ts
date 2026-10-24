// The journal alone, on a database holding only the app's core and this
// feat: entries balance, ids are gapless, nothing posted changes, a payment
// is exactly one, and a correction names its base. Run by `cella test slice
// transaction`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()

type Line = { account: string; side: 'debit' | 'credit'; cents: number }

// Posts an entry in its own transaction, as a write would, returning its id
// or the reason it was refused.
async function post(lines: Line[], corrects: string | null = null, receipt: number | null = null): Promise<{ id?: string; refused?: string }> {
  await db.query('BEGIN')
  try {
    const { rows } = await db.query<{ id: string }>(
      `INSERT INTO transaction.entry (date, label, corrects, receipt) VALUES ('2026-10-24', 'slice', $1, $2) RETURNING id`,
      [corrects, receipt],
    )
    const id = rows[0].id
    for (const [i, l] of lines.entries()) {
      await db.query(
        'INSERT INTO transaction.line (entry, n, account, side, amount) VALUES ($1, $2, $3, $4, cella.amount($5))',
        [id, i + 1, l.account, l.side, l.cents],
      )
    }
    await db.query('COMMIT')
    return { id }
  } catch (e) {
    await db.query('ROLLBACK')
    assert.equal((e as { code?: string }).code, '09000', (e as Error).message)
    return { refused: (e as Error).message }
  }
}

const rent: Line[] = [{ account: '613', side: 'debit', cents: 1200_00 }, { account: '512', side: 'credit', cents: 1200_00 }]

before(async () => {
  await db.connect()
})

after(async () => {
  await db.end()
})

test('only the app\'s core and this feat are migrated', async () => {
  const { rows } = await db.query<{ nspname: string }>(
    `SELECT nspname FROM pg_namespace WHERE nspname IN ('invoice', 'account', 'account_transaction', 'circle_member')`,
  )
  assert.deepEqual(rows, [])
})

test('a balanced entry posts as je-0001; one that does not balance is refused', async () => {
  assert.deepEqual(await post(rent), { id: 'je-0001' })
  const half = await post([rent[0]])
  assert.match(half.refused ?? '', /je-0002 does not balance: 1 lines debit 120000 and credit 0 cents/)
  const uneven = await post([rent[0], { ...rent[1], cents: 1100_00 }])
  assert.match(uneven.refused ?? '', /does not balance: 2 lines debit 120000 and credit 110000 cents/)
})

test('a refused entry returns its number: the journal\'s ids have no gap', async () => {
  assert.deepEqual(await post(rent), { id: 'je-0002' })
  const { rows } = await db.query<{ last: number }>('SELECT last FROM transaction.journal')
  assert.equal(rows[0].last, 2)
})

test('an entry that names an id other than the next is refused', async () => {
  await db.query('BEGIN')
  await assert.rejects(
    db.query(`INSERT INTO transaction.entry (id, date, label) VALUES ('je-0009', '2026-10-24', 'skips')`),
    /je-0009 is not the journal's next entry, je-0003/,
  )
  await db.query('ROLLBACK')
})

test('nothing posted changes: a correction is a new entry', async () => {
  for (const sql of [
    `UPDATE transaction.entry SET label = 'edited' WHERE id = 'je-0001'`,
    `DELETE FROM transaction.line WHERE entry = 'je-0001'`,
  ]) {
    await db.query('BEGIN')
    await assert.rejects(db.query(sql), /the journal is permanent/)
    await db.query('ROLLBACK')
  }
})

test('a payment is 401 debited and 512 credited by its amount, and nothing else, by transaction.pays', async () => {
  const pays = async (entry: string | undefined, amount: number) =>
    (await db.query<{ r: string | null }>('SELECT transaction.pays($1) AS r', [{ entry, amount }])).rows[0].r
  const paid = await post([{ account: '401', side: 'debit', cents: 2400_00 }, { account: '512', side: 'credit', cents: 2400_00 }])
  assert.equal(await pays(paid.id, 2400_00), null)
  assert.match((await pays(paid.id, 1_00)) ?? '', /is not a payment of 100 cents/)
  const rentPaid = await post(rent)
  assert.match((await pays(rentPaid.id, 1200_00)) ?? '', /is not a payment of 120000 cents: 401 debited and 512 credited by it, nothing else/)
  const split = await post([
    { account: '401', side: 'debit', cents: 2400_00 },
    { account: '512', side: 'credit', cents: 1200_00 },
    { account: '512', side: 'credit', cents: 1200_00 },
  ])
  assert.match((await pays(split.id, 2400_00)) ?? '', /is not a payment/)
  assert.equal(await pays('je-9999', 1_00), 'no entry je-9999')
})

test('a correction names its base, and a second from the same base is refused by transaction.corrects', async () => {
  const reverse: Line[] = rent.map((l) => ({ ...l, side: l.side === 'debit' ? 'credit' : 'debit' }))
  const first = await post(reverse, 'je-0001', 1)
  const second = await post(reverse, 'je-0001', 2)
  const rule = async (entry: string | undefined, base: string | null) =>
    (await db.query<{ r: string | null }>('SELECT transaction.corrects($1) AS r', [{ entry, corrects: 'je-0001', base }])).rows[0].r
  assert.equal(await rule(first.id, null), null)
  assert.equal(await rule(second.id, null), `je-0001 moved: its correction is ${first.id}, not none`)
  assert.equal(await rule(second.id, first.id ?? null), null)
})
