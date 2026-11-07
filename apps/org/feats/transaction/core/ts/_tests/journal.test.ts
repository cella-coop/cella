// The journal alone, on a database holding only the app's core and this
// feat: entries balance, ids are gapless, nothing posted changes, a payment
// is exactly one, and a correction names its base; and each write's
// payload folds into the journal it wrote (`sql/009-folds.sql`). Run by
// `cella test slice transaction`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import type { Write } from '@cella/org-db'
import { adjusting, paying, posting } from '@cella/org-transaction/api'

const db = new pg.Client()

// Who reads, on the app's role as the server connects: the rows a query
// returns read as `actor`, or as no one. A stub authority stands in for
// the membership feat's, which says who holds a power.
const app = new pg.Client({ user: 'cella_app' })
const reading = async (actor: string | null, sql: string, values: unknown[] = []) => {
  await app.query(`SELECT set_config('cella.actor', $1, false)`, [actor ?? ''])
  return (await app.query(sql, values)).rows
}

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
  await app.end()
  await db.end()
})

test('only the app\'s core and this feat are migrated', async () => {
  const { rows } = await db.query<{ nspname: string }>(
    `SELECT nspname FROM pg_namespace WHERE nspname IN ('invoice', 'account', 'account_transaction')`,
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
  const guard = async (entry: string | undefined, base: string | null) =>
    (await db.query<{ r: string | null }>('SELECT transaction.corrects($1) AS r', [{ entry, corrects: 'je-0001', base }])).rows[0].r
  assert.equal(await guard(first.id, null), null)
  assert.equal(await guard(second.id, null), `je-0001 moved: its correction is ${first.id}, not none`)
  assert.equal(await guard(second.id, first.id ?? null), null)
})

test('as the app role, whoever keeps the books reads every entry and line; a graft opens an account\'s lines further; no one else reads any', async () => {
  await app.connect()
  await db.query(`CREATE SCHEMA mandate`)
  await db.query(
    `CREATE FUNCTION mandate.may(actor text, power text, cents bigint, about text, day date) RETURNS boolean
     LANGUAGE sql STABLE RETURN actor = 'julien@lanterne.example' AND power = 'record-entry'`,
  )
  await db.query(`GRANT USAGE ON SCHEMA mandate TO cella_app`)
  await db.query(
    `CREATE FUNCTION mandate.covered(actor text, power text, day date) RETURNS text[]
     LANGUAGE sql STABLE RETURN CASE WHEN mandate.may(actor, power, NULL, NULL, day) THEN ARRAY(SELECT id FROM circle.circle) ELSE '{}' END`,
  )
  await db.query(`INSERT INTO cella.authority (fn, covered, owner) VALUES ('mandate.may(text, text, bigint, text, date)', 'mandate.covered(text, text, date)', 'test')`)
  await db.query(`CREATE FUNCTION mandate.holds(code text, reader text) RETURNS boolean LANGUAGE sql STABLE RETURN code = '101302' AND reader = 'chloe@lanterne.example'`)
  await db.query(`INSERT INTO cella.reach (what, fn, owner) VALUES ('transaction', 'mandate.holds(text, text)', 'test')`)
  const { id } = await post([{ account: '512', side: 'debit', cents: 500_00 }, { account: '101302', side: 'credit', cents: 500_00 }])
  const count = async (table: string) => Number((await db.query(`SELECT count(*) AS n FROM transaction.${table}`)).rows[0].n)
  assert.equal((await reading('julien@lanterne.example', 'SELECT id FROM transaction.entry')).length, await count('entry'))
  assert.equal((await reading('julien@lanterne.example', 'SELECT entry FROM transaction.line')).length, await count('line'))
  assert.deepEqual(await reading('paul@lanterne.example', 'SELECT id FROM transaction.entry'), [])
  assert.deepEqual(await reading(null, 'SELECT entry FROM transaction.line'), [])
  assert.deepEqual(await reading('chloe@lanterne.example', 'SELECT id FROM transaction.entry'), [{ id }], 'she reads the entry that holds a line opened to her')
  assert.deepEqual(await reading('chloe@lanterne.example', 'SELECT entry, account FROM transaction.line'), [{ entry: id, account: '101302' }], 'and that line alone')
})

test('the authority and a graft\'s opening, overloaded under their names, run the overloads registered', async () => {
  // The functions registered take the reader as varchar; each overload
  // takes the text a call passes, which a call by name alone would
  // prefer, and would open every row to everyone.
  await db.query(
    `CREATE FUNCTION mandate.vmay(actor varchar, power varchar, cents bigint, about text, day date) RETURNS boolean
     LANGUAGE sql STABLE RETURN mandate.may(actor, power, cents, about, day)`,
  )
  await db.query(`CREATE FUNCTION mandate.vmay(actor text, power text, cents bigint, about text, day date) RETURNS boolean LANGUAGE sql STABLE RETURN true`)
  await db.query(
    `CREATE FUNCTION mandate.vcovered(actor varchar, power varchar, day date) RETURNS text[]
     LANGUAGE sql STABLE RETURN mandate.covered(actor, power, day)`,
  )
  await db.query(`CREATE FUNCTION mandate.vcovered(actor text, power text, day date) RETURNS text[] LANGUAGE sql STABLE RETURN ARRAY(SELECT id FROM circle.circle)`)
  await db.query(`CREATE FUNCTION mandate.vholds(code varchar, reader varchar) RETURNS boolean LANGUAGE sql STABLE RETURN mandate.holds(code, reader)`)
  await db.query(`CREATE FUNCTION mandate.vholds(code text, reader text) RETURNS boolean LANGUAGE sql STABLE RETURN true`)
  await db.query(`UPDATE cella.authority SET fn = 'mandate.vmay(varchar, varchar, bigint, text, date)', covered = 'mandate.vcovered(varchar, varchar, date)'`)
  await db.query(`UPDATE cella.reach SET fn = 'mandate.vholds(varchar, varchar)' WHERE what = 'transaction'`)
  try {
    const opened = (await db.query(`SELECT entry, account FROM transaction.line WHERE account = '101302'`)).rows
    assert.equal(opened.length, 1)
    assert.equal((await reading('julien@lanterne.example', 'SELECT id FROM transaction.entry')).length, Number((await db.query('SELECT count(*) AS n FROM transaction.entry')).rows[0].n))
    assert.deepEqual(await reading('paul@lanterne.example', 'SELECT id FROM transaction.entry'), [])
    assert.deepEqual(await reading('chloe@lanterne.example', 'SELECT entry, account FROM transaction.line'), opened)
  } finally {
    await db.query(`UPDATE cella.authority SET fn = 'mandate.may(text, text, bigint, text, date)', covered = 'mandate.covered(text, text, date)'`)
    await db.query(`UPDATE cella.reach SET fn = 'mandate.holds(text, text)' WHERE what = 'transaction'`)
  }
})

test('a check an extender registers runs on every line posted, and refuses the line it raises on', async () => {
  await db.query(`CREATE SCHEMA extender`)
  await db.query(
    `CREATE FUNCTION extender.no_666(line transaction.line) RETURNS void LANGUAGE plpgsql AS $$
     BEGIN
       IF line.account = '666' THEN
         RAISE EXCEPTION '% posts to 666', line.entry USING ERRCODE = 'triggered_action_exception';
       END IF;
     END $$`,
  )
  await db.query(`SELECT transaction.register_line_check('extender.no_666(transaction.line)', 'test')`)
  const refused = await post([{ account: '666', side: 'debit', cents: 1_00 }, { account: '512', side: 'credit', cents: 1_00 }])
  assert.match(refused.refused ?? '', /je-\d+ posts to 666/)
  assert.ok((await post(rent)).id, 'a line the check passes posts')
})

test('a check overloaded under its name runs the overload registered: a line posts, and the check refuses as before', async () => {
  // The check registered takes the line as a domain over it; the overload
  // takes the line's own type, which a call by name alone would prefer.
  await db.query(`CREATE DOMAIN extender.line AS transaction.line`)
  await db.query(
    `CREATE FUNCTION extender.no_777(line extender.line) RETURNS void LANGUAGE plpgsql AS $$
     BEGIN
       IF (line).account = '777' THEN
         RAISE EXCEPTION '% posts to 777', (line).entry USING ERRCODE = 'triggered_action_exception';
       END IF;
     END $$`,
  )
  await db.query(`SELECT transaction.register_line_check('extender.no_777(extender.line)', 'test')`)
  await db.query(
    `CREATE FUNCTION extender.no_777(line transaction.line) RETURNS void LANGUAGE plpgsql AS $$
     BEGIN
       RAISE EXCEPTION 'the overload ran' USING ERRCODE = 'triggered_action_exception';
     END $$`,
  )
  assert.ok((await post(rent)).id, 'a line the check passes posts')
  const refused = await post([{ account: '777', side: 'debit', cents: 1_00 }, { account: '512', side: 'credit', cents: 1_00 }])
  assert.match(refused.refused ?? '', /je-\d+ posts to 777/)
})

// The journal's rows, as JSON text, sorted, without the receipt, which a
// fold reads from the log.
const journal = async () =>
  (
    await db.query<{ r: string[] }>(
      `SELECT ARRAY(SELECT (to_jsonb(e) - 'receipt')::text FROM transaction.entry e ORDER BY 1)
              || ARRAY(SELECT to_jsonb(l)::text FROM transaction.line l ORDER BY 1)
              || ARRAY(SELECT to_jsonb(j)::text FROM transaction.journal j) AS r`,
    )
  ).rows[0].r

// The write's state, then, in its place, its payload folded as entry `n`:
// both leave the same journal, and neither stays.
async function folds<T>(w: Write<T>, n: number) {
  await db.query('BEGIN')
  const payload = w.payload(await w.state(db, {} as never))
  const written = await journal()
  await db.query('ROLLBACK')
  await db.query('BEGIN')
  try {
    await db.query('SELECT transaction.fold_post($1)', [{ n, op: w.op, actor: 'julien@lanterne.example', date: '2026-10-24', cause: null, payload }])
    assert.deepEqual(await journal(), written)
  } finally {
    await db.query('ROLLBACK')
  }
}

test('a post, a payment to a supplier and a correction fold into the journal each wrote', async () => {
  const supplies = { date: '2026-10-24', label: 'Supplies', lines: [{ account: '606', side: 'debit' as const, cents: 12_00 }, { account: '401', side: 'credit' as const, cents: 12_00 }] }
  await folds(posting(supplies), 1)
  await folds(paying({ date: '2026-10-24', label: 'Paper', cents: 80_00 }), 2)
  const corrected = (await db.query<{ id: string }>('SELECT id FROM transaction.entry ORDER BY id LIMIT 1')).rows[0].id
  await folds(adjusting({ corrects: corrected, base: null, entry: { ...supplies, label: 'Supplies, corrected', lines: supplies.lines.map((l) => ({ ...l, side: l.side === 'debit' ? 'credit' : 'debit' })) } }), 3)
  await assert.rejects(
    db.query('SELECT transaction.fold_post($1)', [{ n: 4, op: 'transaction:transaction:post', actor: 'julien@lanterne.example', date: '2026-10-24', cause: null, payload: { entry: 'je-9999', date: '2026-10-24', lines: [] } }]),
    /entry 4 keeps no label and lines for je-9999/,
  )
})

test('the journal numbers on past four digits: je-10000 follows je-9999, and neither collides', async () => {
  await db.query('BEGIN')
  try {
    await db.query('UPDATE transaction.journal SET last = 9998')
    const ids: string[] = []
    for (const label of ['the 9,999th', 'the 10,000th', 'the 10,001st']) {
      ids.push((await db.query<{ id: string }>(`INSERT INTO transaction.entry (date, label) VALUES ('2026-10-24', $1) RETURNING id`, [label])).rows[0].id)
    }
    assert.deepEqual(ids, ['je-9999', 'je-10000', 'je-10001'])
  } finally {
    await db.query('ROLLBACK')
  }
})
