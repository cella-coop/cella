// The books scenario, end to end on a seeded Lanterne: invoices into the
// books. Issue, payment and void post balanced entries in the same
// transaction as the invoice write; nothing posts into a closed period; and
// guards run as a role that reads and cannot write. Run by `cella test` on a
// fresh database.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parse } from 'smol-toml'
import pg from 'pg'
import { annul, issue, payment } from '@cella/org-graft-invoice-transaction/api'
import { link } from '@cella/org-graft-client-invoice/api'
import { send } from '@cella/org-invoice/api'
import { adjust, post } from '@cella/org-transaction/api'
import { close } from '@cella/org-account/api'
import type { Deps } from '@cella/org-db'
import { sign } from './lanterne.ts'

const su = new pg.Client()
let app: pg.Client

const julien = 'julien@lanterne.example'
const fixture = new URL('../../fixtures/lanterne/', import.meta.url)

async function on(date: string) {
  await su.query(`ALTER ROLE cella_app IN DATABASE ${su.escapeIdentifier(su.database ?? '')} SET cella.clock = '${date}'`)
  await app?.end()
  app = new pg.Client({ user: 'cella_app' })
  await app.connect()
}

const as = (actor: string): Deps => ({ db: app, actor, sign: sign(actor) })
const all = async <R>(sql: string, values: unknown[] = []) => (await su.query(sql, values)).rows as R[]
const one = async <R>(sql: string, values: unknown[] = []) => (await all<R>(sql, values))[0]
const head = async () => Number((await one<{ n: string }>('SELECT n FROM cella.head')).n)
const reason = (out: { state: string; reason?: string }) => (out.state === 'refused' ? out.reason ?? '' : '')

type Line = { account: string; side: string; cents: number }
const lines = async (entry: string) =>
  (await all<{ account: string; side: string; cents: string }>(
    'SELECT account, side, cella.cents(amount) AS cents FROM transaction.line WHERE entry = $1 ORDER BY n',
    [entry],
  )).map((l): Line => ({ account: l.account, side: l.side, cents: Number(l.cents) }))

const standing = async (invoice: string) =>
  one<{ state: string; owed: string; credit: string; paid: string }>('SELECT * FROM invoice.standing WHERE id = $1', [invoice])

const balances = async () =>
  new Map((await all<{ code: string; balance: string }>('SELECT code, balance FROM account_transaction.balance'))
    .map((b) => [b.code, Number(b.balance)]))

before(async () => {
  await su.connect()
  // The host stages a series moved around the notary, as only a
  // superuser may.
  await su.query('SET cella.unbound = on')
  await on('2026-10-24')
})

after(async () => {
  await app.end()
  await su.end()
})

test('the seed carries the books over: the trial balance is the fixture\'s', async () => {
  assert.equal(await head(), 1)
  const journal = parse(readFileSync(new URL('transaction.toml', fixture), 'utf8')) as {
    entry: { line: { account: string; debit?: number; credit?: number }[] }[]
  }
  const want = new Map<string, number>()
  for (const l of journal.entry.flatMap((e) => e.line)) {
    want.set(l.account, (want.get(l.account) ?? 0) + (l.debit ?? 0) - (l.credit ?? 0))
  }
  const have = await balances()
  for (const [code, cents] of want) {
    assert.equal(have.get(code), cents, `account ${code}`)
  }
  assert.equal(have.get('512'), 39_296_00, 'the bank holds 39 296 €')
  assert.equal(have.get('411'), 57_180_00, 'clients owe 57 180 €')
})

test('issuing F-2026-0056 takes the next number and posts a balanced entry', async () => {
  const issued = await issue({
    series: 'F-2026',
    bill_to: 'Maison Ferrand',
    label: 'Packaging, range of six: print preparation',
    lines: [
      { description: 'Print preparation, days', quantity: '2.5', unit_price: 520_00, vat_rate: 2000 },
      { description: 'Proofs', quantity: '1', unit_price: 180_00, vat_rate: 2000 },
    ],
  }, as(julien))
  assert.deepEqual(issued, {
    state: 'settled',
    entry: 2,
    value: { invoice: 'F-2026-0056', issued: '2026-10-24', net: 1480_00, vat: 296_00, total: 1776_00, entry: 'je-0041' },
  })
  assert.equal(Number((await one<{ next: number }>(`SELECT next FROM invoice.series WHERE name = 'F-2026'`)).next), 57)
  assert.deepEqual(await lines('je-0041'), [
    { account: '411', side: 'debit', cents: 1776_00 },
    { account: '706', side: 'credit', cents: 1480_00 },
    { account: '44571', side: 'credit', cents: 296_00 },
  ])
  const logged = await one<{ guards: { owner: string }[] }>('SELECT guards FROM cella.log WHERE n = 2')
  assert.deepEqual(logged.guards.map((r) => r.owner), ['invoice', 'invoice-transaction', 'membership'])

  const linked = await link({ invoice: 'F-2026-0056', client: 'ferrand' }, as(julien))
  assert.equal(linked.state, 'settled')
  assert.equal(linked.entry, 3)
})

test('a gap or a reused number is refused, and uses no verdict number', async () => {
  const draft = { series: 'F-2026', bill_to: 'Atelier Ondine', label: 'Shop upkeep', lines: [{ description: 'Upkeep', quantity: '1', unit_price: 300_00, vat_rate: 2000 }] }

  await su.query(`UPDATE invoice.series SET next = 58 WHERE name = 'F-2026'`)
  const gap = await issue(draft, as(julien))
  assert.equal(gap.state, 'refused')
  assert.match(reason(gap), /F-2026-0058 leaves a gap: F-2026-0057 was never issued/)

  await su.query(`UPDATE invoice.series SET next = 56 WHERE name = 'F-2026'`)
  const reused = await issue(draft, as(julien))
  assert.equal(reused.state, 'refused')
  assert.match(reason(reused), /F-2026-0056 is already issued: a number is never reused/)

  await su.query(`UPDATE invoice.series SET next = 57 WHERE name = 'F-2026'`)
  assert.equal(await head(), 3)
  assert.equal(Number((await one<{ count: string }>(`SELECT count(*) FROM invoice.invoice`)).count), 16)
})

test('a payment posts', async () => {
  const paid = await payment({ invoice: 'F-2026-0044', at: '2026-10-24', amount: 7440_00, reference: 'CC-2610-0044' }, as(julien))
  assert.equal(paid.state, 'settled')
  assert.equal(paid.state === 'settled' && paid.value.merged, false)
  const entry = paid.state === 'settled' ? paid.value.entry ?? '' : ''
  assert.deepEqual(await lines(entry), [
    { account: '512', side: 'debit', cents: 7440_00 },
    { account: '411', side: 'credit', cents: 7440_00 },
  ])
  assert.equal((await standing('F-2026-0044')).state, 'paid')
})

test('an overpayment on 0051 leaves a credit owed to Vélo Solidaire rather than refusing', async () => {
  const paid = await payment({ invoice: 'F-2026-0051', at: '2026-10-24', amount: 2500_00, reference: 'CC-2610-0051' }, as(julien))
  assert.equal(paid.state, 'settled')
  const s = await standing('F-2026-0051')
  assert.deepEqual([s.state, Number(s.owed), Number(s.credit)], ['overpaid', 0, 520_00])
  const velo = await one<{ owed: string; credit: string }>(`SELECT owed, credit FROM client_invoice.standing WHERE client = 'velo'`)
  assert.deepEqual([Number(velo.owed), Number(velo.credit)], [0, 520_00])
})

test('a bank reference recorded twice merges into one payment', async () => {
  const pay = { invoice: 'F-2026-0052', at: '2026-10-24', amount: 16800_00, reference: 'CC-2610-0052' }
  const first = await payment(pay, as(julien))
  const again = await payment(pay, as(julien))
  assert.equal(first.state === 'settled' && first.value.merged, false)
  assert.equal(again.state === 'settled' && again.value.merged, true)
  assert.equal(again.state === 'settled' && again.value.entry, null)
  assert.equal(again.state === 'settled' && first.state === 'settled' && again.value.payment, first.state === 'settled' && first.value.payment)
  const count = await one<{ payments: string; postings: string }>(
    `SELECT (SELECT count(*) FROM invoice.payment WHERE invoice = 'F-2026-0052') AS payments,
            (SELECT count(*) FROM invoice_transaction.posting WHERE invoice = 'F-2026-0052' AND event = 'payment') AS postings`,
  )
  assert.deepEqual([Number(count.payments), Number(count.postings)], [1, 1])
  assert.equal((await standing('F-2026-0052')).state, 'paid')
})

test('voiding a paid invoice is refused, and uses no verdict number', async () => {
  const before = await head()
  const refused = await annul({ invoice: 'F-2026-0051', reason: 'wrong client' }, as(julien))
  assert.equal(refused.state, 'refused')
  assert.match(reason(refused), /F-2026-0051 has a payment, so it is not voided/)
  assert.equal(refused.state === 'refused' && refused.verdict, before)
  assert.equal(await head(), before)
  assert.equal((await one<{ voided: string | null }>(`SELECT voided FROM invoice.invoice WHERE id = 'F-2026-0051'`)).voided, null)
  assert.equal((await all(`SELECT FROM invoice_transaction.posting WHERE invoice = 'F-2026-0051' AND event = 'void'`)).length, 0)
})

test('voiding an unpaid invoice posts a credit note', async () => {
  const voided = await annul({ invoice: 'F-2026-0056', reason: 'issued against the wrong range' }, as(julien))
  assert.equal(voided.state, 'settled')
  const entry = voided.state === 'settled' ? voided.value.entry ?? '' : ''
  assert.deepEqual(await lines(entry), [
    { account: '411', side: 'credit', cents: 1776_00 },
    { account: '706', side: 'debit', cents: 1480_00 },
    { account: '44571', side: 'debit', cents: 296_00 },
  ])
  const s = await standing('F-2026-0056')
  assert.deepEqual([s.state, Number(s.owed)], ['voided', 0])
  const unsent = await send({ invoice: 'F-2026-0056' }, as(julien))
  assert.equal(unsent.state, 'settled')
  assert.equal(unsent.value.sent, null, 'a voided invoice is not sent')
  const logged = await one<{ guards: { owner: string }[] }>('SELECT guards FROM cella.log WHERE n = $1', [voided.state === 'settled' && voided.entry])
  assert.deepEqual(logged.guards.map((r) => r.owner), ['invoice', 'invoice-transaction', 'membership'])
})

test('posting into September, which is closed, is refused by the account-transaction graft', async () => {
  const before = await head()
  const repair = { label: 'Plotter repair', lines: [{ account: '613', side: 'debit' as const, cents: 180_00 }, { account: '401', side: 'credit' as const, cents: 180_00 }] }

  const late = await post({ date: '2026-09-30', ...repair }, as(julien))
  assert.equal(late.state, 'refused')
  assert.match(reason(late), /2026-09 is closed: je-\d+ cannot post into it/)

  const unbalanced = await post({ date: '2026-10-24', label: 'Half an entry', lines: [repair.lines[0]] }, as(julien))
  assert.match(reason(unbalanced), /does not balance/)

  const unknown = await post({ date: '2026-10-24', label: 'Nowhere', lines: [{ ...repair.lines[0], account: '999' }, repair.lines[1]] }, as(julien))
  assert.match(reason(unknown), /posts to 999, which is no account/)
  assert.equal(await head(), before)

  const posted = await post({ date: '2026-10-24', ...repair }, as(julien))
  assert.equal(posted.state, 'settled')
  assert.equal(posted.state === 'settled' && posted.entry, before + 1)
})

test('a post that touches the bank is refused: money leaves it only through pay and payroll', async () => {
  const before = await head()
  const out = await post({
    date: '2026-10-24',
    label: 'Plotter repair, paid at once',
    lines: [{ account: '613', side: 'debit', cents: 180_00 }, { account: '512', side: 'credit', cents: 180_00 }],
  }, as(julien))
  assert.equal(out.state, 'refused')
  assert.match(reason(out), /je-\d+ posts to 512, a cash account: money moves through pay or payroll/)
  const into = await post({
    date: '2026-10-24',
    label: 'Deposit',
    lines: [{ account: '512', side: 'debit', cents: 50_00 }, { account: '401', side: 'credit', cents: 50_00 }],
  }, as(julien))
  assert.match(reason(into), /posts to 512, a cash account/)
  assert.equal(await head(), before)
})

test('a refused post leaves no gap in the journal\'s ids', async () => {
  const last = async () => (await one<{ n: number }>(`SELECT max(substr(id, 4)::int) AS n FROM transaction.entry`)).n
  const before = await last()
  const repair = [{ account: '613', side: 'debit' as const, cents: 90_00 }, { account: '401', side: 'credit' as const, cents: 90_00 }]
  const refused = await post({ date: '2026-09-30', label: 'Plotter repair, late', lines: repair }, as(julien))
  assert.equal(refused.state, 'refused')
  const posted = await post({ date: '2026-10-24', label: 'Plotter repair', lines: repair }, as(julien))
  assert.equal(posted.state, 'settled')
  assert.equal(posted.value.entry, `je-${String(before + 1).padStart(4, '0')}`)
  const ids = await one<{ count: string; max: number }>(`SELECT count(*), max(substr(id, 4)::int) FROM transaction.entry`)
  assert.equal(Number(ids.count), ids.max, 'the journal runs from je-0001 with no gap')
})

test('a correction names its base, and a second from the same base is refused', async () => {
  const reversal = {
    date: '2026-10-24',
    label: 'Reverses je-0028, the August VAT return',
    lines: [
      { account: '44571', side: 'credit' as const, cents: 3360_00 },
      { account: '44566', side: 'debit' as const, cents: 604_00 },
      { account: '512', side: 'debit' as const, cents: 2756_00 },
    ],
  }
  const first = await adjust({ corrects: 'je-0028', base: null, entry: reversal }, as(julien))
  assert.equal(first.state, 'settled')
  const second = await adjust({ corrects: 'je-0028', base: null, entry: reversal }, as(julien))
  assert.equal(second.state, 'refused')
  assert.match(reason(second), /je-0028 moved: its correction is je-\d+, not none/)

  // je-0028 credited the bank and debited it nothing, so a correction of it
  // may return cash to 512 but never take it out.
  const payout = await adjust({
    corrects: 'je-0028',
    base: first.state === 'settled' ? first.value.entry : null,
    entry: { date: '2026-10-24', label: 'VAT, again', lines: [{ account: '44571', side: 'debit', cents: 100_00 }, { account: '512', side: 'credit', cents: 100_00 }] },
  }, as(julien))
  assert.equal(payout.state, 'refused')
  assert.match(reason(payout), /je-\d+ credits 512 beyond what je-0028 debited it: a correction returns cash, it never pays it out/)
})

test('the books agree with the invoices, and every entry balances', async () => {
  const owed = await one<{ owed: string; credit: string }>('SELECT sum(owed) AS owed, sum(credit) AS credit FROM invoice.standing')
  const b = await balances()
  assert.equal(b.get('411'), Number(owed.owed) - Number(owed.credit))
  const total = await one<{ debit: string; credit: string }>('SELECT sum(debit) AS debit, sum(credit) AS credit FROM account_transaction.balance')
  assert.equal(total.debit, total.credit)
})

test('October closes only after it ends, and then takes no posts', async () => {
  const early = await close({ month: '2026-10' }, as(julien))
  assert.match(reason(early), /2026-10 runs until 2026-10-31/)

  await on('2026-11-05')
  const closed = await close({ month: '2026-10' }, as(julien))
  assert.equal(closed.state, 'settled')
  const late = await post({ date: '2026-10-31', label: 'Late', lines: [{ account: '613', side: 'debit', cents: 1_00 }, { account: '401', side: 'credit', cents: 1_00 }] }, as(julien))
  assert.match(reason(late), /2026-10 is closed/)
  const again = await close({ month: '2026-10' }, as(julien))
  assert.match(reason(again), /2026-10 closed on 2026-11-05/)
})

// A guard registered and submitted, signed by Julien, inside a superuser
// transaction that rolls back, so the probe leaves nothing behind.
async function probe(body: string, opts = '') {
  const signed = { request: {}, ...await sign(julien)('probe:probe:run', {}) }
  await su.query('BEGIN')
  try {
    await su.query('CREATE SCHEMA probe')
    await su.query('GRANT USAGE ON SCHEMA probe TO cella_guards')
    await su.query(`CREATE FUNCTION probe.guard(payload jsonb) RETURNS text LANGUAGE sql STABLE ${opts} AS $$ ${body} $$`)
    await su.query(`INSERT INTO cella.guard (op, fn, owner) VALUES ('probe:probe:run', 'probe.guard(jsonb)', 'probe')`)
    await su.query(`SELECT cella.begin('probe:probe:run', $1, decode($2, 'hex'))`, [julien, signed.device])
    await su.query(`SELECT * FROM cella.submit('probe:probe:run', '{}', $1, $2)`, [julien, signed])
    return ''
  } catch (e) {
    return (e as Error).message
  } finally {
    await su.query('ROLLBACK')
  }
}

test('guards run as cella_guards, which reads the scope and can neither write nor read the key', async () => {
  assert.equal(await probe('SELECT current_user::text'), 'cella_guards')
  assert.equal(await probe(`SELECT 'reads ' || count(*) FROM invoice.invoice`), 'reads 16')

  await su.query('CREATE SCHEMA scribble')
  await su.query(`CREATE FUNCTION scribble.write() RETURNS text LANGUAGE sql VOLATILE AS $$
    INSERT INTO invoice.series (name, next) VALUES ('X-2026', 1) RETURNING name $$`)
  await su.query('GRANT USAGE ON SCHEMA scribble TO cella_guards')
  assert.match(await probe('SELECT scribble.write()'), /permission denied for table series/)
  assert.match(await probe(`SELECT nextval('cella.receipt_seq')::text`), /permission denied for sequence receipt_seq/)
  assert.match(await probe('SELECT verdict::text FROM cella.submit(\'x:y:z\', \'{}\', \'probe\', \'{}\')'), /permission denied for function submit/)
  await su.query('DROP SCHEMA scribble CASCADE')

  const key = (await one<{ key_file: string }>('SHOW cella.key_file')).key_file
  assert.match(await probe(`SELECT encode(pg_read_binary_file('${key}'), 'hex')`), /permission denied for function pg_read_binary_file/)
  assert.match(await probe(`SELECT current_setting('cella.key_file')`), /permission denied|must be superuser|privileges of pg_read_all_settings/)
  assert.match(await probe(`SELECT current_setting('cella.vault_key_file')`), /permission denied|must be superuser|privileges of pg_read_all_settings/)
  assert.match(await probe('SELECT cella.vault_rewrap()::text'), /permission denied for function vault_rewrap/)
  assert.match(await probe('SELECT NULL::text', 'SECURITY DEFINER'), /security definer; a guard runs as cella_guards/)

  await su.query('BEGIN')
  await su.query('SET LOCAL ROLE cella_guards')
  await assert.rejects(su.query(`INSERT INTO transaction.entry (date, label) VALUES ('2026-10-24', 'forged')`), /permission denied/)
  await su.query('ROLLBACK')
})

test('the log verifies', async () => {
  assert.equal((await one<{ v: boolean }>('SELECT cella.verify_log() AS v')).v, true)
  const log = await one<{ count: string; max: string }>('SELECT count(*), max(n) FROM cella.log')
  assert.deepEqual([Number(log.count), Number(log.max)], [await head(), await head()])
})
