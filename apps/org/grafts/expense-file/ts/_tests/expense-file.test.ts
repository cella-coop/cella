// Receipts on expenses, on a database holding the app's core, the
// expense and file feats and this graft: a claim carrying its receipt in
// one write, the receipt a file of class expense-receipt about the
// member, committed to and never logged; another attached later; and a
// receipt refused on someone else's expense, or on one reimbursed. Run by
// `cella test slice expense-file`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import type { Deps } from '@cella/org-db'
import { fixture, signer } from '@cella/org-sign'
import { attach, capture, counts, receipts } from '../src/api/index.ts'

const db = new pg.Client()
const scope = 'test.example'
const sofia = 'sofia@test.example'
const thomas = 'thomas@test.example'
const as = (who: string): Deps => ({ db, actor: who, sign: signer(scope, who, fixture(who, 'laptop')) })
const scan = (text: string) => ({ class: 'expense-receipt' as const, subject: sofia, name: 'ticket.pdf', type: 'application/pdf', bytes: new TextEncoder().encode(text) })
const claim = { member: sofia, day: '2026-10-19', label: 'Print proofs', category: '606', net: 15000, vat: 3000, receipt: null }

const reason = (out: { state: string; reason?: string }) => (out.state === 'refused' ? (out.reason ?? '') : `not refused: ${out.state}`)

before(async () => {
  await db.connect()
  // Every actor holds every power, in place of core's guard on every power,
  // which reads seats and mandates this test does not make.
  await db.query(`DELETE FROM cella.guard WHERE fn = 'circle_person.empowered(jsonb)'::regprocedure`)
  await db.query(`SET cella.clock = '2026-10-24'`)
  await db.query(`SET cella.scope = '${scope}'`)
  await db.query(`CREATE FUNCTION public.anyone(actor text, device bytea) RETURNS text LANGUAGE sql STABLE RETURN NULL`)
  await db.query('DELETE FROM cella.keyring')
  await db.query(`INSERT INTO cella.keyring (fn, owner) VALUES ('public.anyone(text, bytea)', 'test')`)
})

after(async () => {
  await db.end()
})

test('only the app\'s core, the expense and file feats and this graft are migrated', async () => {
  const { rows } = await db.query(`SELECT nspname FROM pg_namespace WHERE nspname IN ('membership', 'expense_membership', 'file_membership')`)
  assert.deepEqual(rows, [])
})

test('a claim carries its receipt in one write, a file about the member committed to in the log', async () => {
  const out = await capture({ ...claim, file: scan('imprimerie du parc') }, as(sofia))
  assert.equal(out.state, 'settled', reason(out))
  const held = await receipts(db, 'ex-0001')
  assert.equal(held.length, 1)
  const { rows } = await db.query(`SELECT class, subject, uploader FROM file.file WHERE id = $1`, [held[0].id])
  assert.deepEqual(rows[0], { class: 'expense-receipt', subject: sofia, uploader: sofia })
  const logged = (await db.query<{ form: Record<string, any> }>(`SELECT form FROM cella.log WHERE op = 'expense:expense:capture'`)).rows[0].form
  assert.equal(logged.file, held[0].id)
  assert.match(logged.name.$commit, /^[0-9a-f]{64}$/)
  assert.match(logged.hash.$commit, /^[0-9a-f]{64}$/)
  assert.ok(!JSON.stringify(logged).includes('ticket.pdf'))
})

test('a claim without a receipt attaches nothing, and one is attached later', async () => {
  const out = await capture({ ...claim, label: 'Train', category: '6251', file: null }, as(sofia))
  assert.equal(out.state, 'settled', reason(out))
  assert.deepEqual(await receipts(db, 'ex-0002'), [])
  const later = await attach({ expense: 'ex-0002', file: scan('sncf') }, as(sofia))
  assert.equal(later.state, 'settled', reason(later))
  assert.deepEqual(await counts(db), { 'ex-0001': { receipts: 1 }, 'ex-0002': { receipts: 1 } })
})

test('a receipt is refused on someone else\'s expense, and on one reimbursed', async () => {
  assert.match(reason(await attach({ expense: 'ex-0001', file: scan('not mine') }, as(thomas))), /thomas@test.example may not attach a receipt to sofia@test.example's expense/)
  assert.match(reason(await attach({ expense: 'ex-0009', file: scan('none') }, as(sofia))), /no expense ex-0009/)
  await db.query(`UPDATE expense.expense SET status = 'submitted', submitted = '2026-10-24' WHERE id = 'ex-0001'`)
  await db.query(`UPDATE expense.expense SET status = 'approved', decided = '2026-10-24', decider = $1 WHERE id = 'ex-0001'`, [thomas])
  await db.query(`UPDATE expense.expense SET status = 'reimbursed', reimbursed = '2026-10-24' WHERE id = 'ex-0001'`)
  assert.match(reason(await attach({ expense: 'ex-0001', file: scan('late') }, as(sofia))), /ex-0001 is reimbursed/)
  // Nothing of a refused write stays: no file, no receipt.
  assert.equal((await db.query(`SELECT count(*)::int AS n FROM file.file`)).rows[0].n, 2)
})
