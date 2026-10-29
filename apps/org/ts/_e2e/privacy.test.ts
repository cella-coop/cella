// The privacy scenario, end to end on a seeded Lanterne, through the
// handlers: Camille erases Margaux Roux, Les Halles' contact, at her
// request; Léa gives her email and phone, then erases them herself; Chloé
// leaves, and the assembly erases her personal data by decision, her name
// at once, her payslips, time, receipts and capital account's label restricted
// until their legal clocks run out and the sweep redacts them. The log
// verifies throughout. Run by `cella test e2e privacy`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { vote } from '@cella/org-decision/api'
import { carried, close, put } from '@cella/org-graft-circle-decision-membership/api'
import { erase as eraseClient, update } from '@cella/org-client/api'
import { capture } from '@cella/org-expense/api'
import { forget, profile } from '@cella/org-person/api'
import type { Deps } from '@cella/org-db'
import { sign } from './lanterne.ts'

const su = new pg.Client()
let app: pg.Client

const camille = 'camille@lanterne.example'
const julien = 'julien@lanterne.example'
const lea = 'lea@lanterne.example'
const chloe = 'chloe@lanterne.example'
const margaux = 'halles-roux'

async function on(date: string) {
  await su.query(`ALTER ROLE cella_app IN DATABASE ${su.escapeIdentifier(su.database ?? '')} SET cella.clock = '${date}'`)
  await app?.end()
  app = new pg.Client({ user: 'cella_app' })
  await app.connect()
}

const as = (actor: string): Deps => ({ db: app, actor, sign: sign(actor) })
const all = async <R>(sql: string, values: unknown[] = []) => (await su.query(sql, values)).rows as R[]
const one = async <R>(sql: string, values: unknown[] = []) => (await all<R>(sql, values))[0]
const reason = (out: { state: string; reason?: string }) => (out.state === 'refused' ? out.reason ?? '' : '')
const settled = <T>(out: { state: string; value?: T; entry?: number; reason?: string }) => {
  assert.equal(out.state, 'settled', reason(out))
  return out as { value: T; entry: number }
}
const verifies = async () => (await one<{ v: boolean }>('SELECT cella.verify_log() AS v')).v
const opened = async (n: number) => (await one<{ o: Record<string, any> }>('SELECT cella.opened($1) AS o', [n])).o
const erased = async (subject: string) =>
  Object.fromEntries((await all<{ class: string; restricted: boolean }>('SELECT class, restricted FROM vault.erased WHERE subject = $1 ORDER BY class', [subject])).map((r) => [r.class, r.restricted]))

// A decision about Chloé, put to the assembly: every active member on its
// roll consents, it closes and its close carries it out.
async function decided(kind: 'exit' | 'erase', from: string, until: string) {
  await on(from)
  const proposed = settled(await put({ kind, args: { member: chloe }, deadline: until, body: '' }, as(camille))).value as { decision: string }
  const roll = await all<{ member: string }>(
    `SELECT r.member FROM circle_decision_membership.roll r JOIN membership.member m ON m.address = r.member
     WHERE r.decision = $1 AND m.status = 'active'`,
    [proposed.decision],
  )
  for (const { member } of roll) {
    settled(await vote({ decision: proposed.decision, member, stance: 'consent' }, as(member)))
  }
  await on(until)
  settled(await close({ decision: proposed.decision }, as(camille)))
  return carried(proposed.decision, as(camille))
}

before(async () => {
  await su.connect()
  await on('2026-10-24')
})

after(async () => {
  await app.end()
  await su.end()
})

test('only a holder of erase-personal-data erases a client: Julien may not, Camille may', async () => {
  assert.match(reason(await eraseClient({ id: margaux }, as(julien))), /erase-personal-data/)
  const done = settled(await eraseClient({ id: margaux }, as(camille)))
  assert.deepEqual(
    await one('SELECT name, email, phone, note, status FROM client.client WHERE id = $1', [margaux]),
    { name: 'redacted', email: 'redacted', phone: 'redacted', note: 'redacted', status: 'archived' },
  )
  assert.deepEqual(await erased(margaux), { contact: false })
  assert.deepEqual((await opened(done.entry)).erasure, { $erasure: { subject: margaux, erased: ['contact'], restricted: [] } })
  // The company she worked for keeps its name.
  assert.equal((await one<{ name: string }>(`SELECT name FROM client.client WHERE id = 'halles'`)).name, 'Les Halles Paysannes')
})

test('erasure wins: a later update of Margaux\'s email is refused', async () => {
  assert.match(reason(await update({ id: margaux, fields: { email: 'margaux@new.example' } }, as(camille))), /erasure wins/)
})

test('Léa gives her email and phone, which the log commits to and the vault opens; then she erases them herself', async () => {
  const given = settled(await profile({ person: lea, email: 'lea@bernard.example', phone: '+33 7 00 00 00 01' }, as(lea)))
  const opened1 = await opened(given.entry)
  assert.deepEqual([opened1.values.email, opened1.values.phone], ['lea@bernard.example', '+33 7 00 00 00 01'])
  assert.match(reason(await forget({ person: lea }, as(camille))), /camille@lanterne\.example may not erase lea@lanterne\.example's contact details/)
  settled(await forget({ person: lea }, as(lea)))
  assert.deepEqual(await one('SELECT name, email, phone FROM person.person WHERE address = $1', [lea]), { name: 'Léa Bernard', email: 'redacted', phone: 'redacted' })
  const opened2 = await opened(given.entry)
  assert.deepEqual([opened2.values.email, opened2.values.phone], ['redacted', 'redacted'])
  assert.equal(await verifies(), true)
})

test('an active member\'s personal data is not erased: the decision is refused at its proposal', async () => {
  const out = await put({ kind: 'erase', args: { member: chloe }, deadline: '2026-11-07', body: '' }, as(camille))
  assert.match(reason(out), /chloe@lanterne\.example is active: only a member who has left is erased/)
})

let receipt = 0

test('Chloé claims a receipt, which the log commits to, and leaves by the assembly\'s decision', async () => {
  const claimed = settled(
    await capture({ member: chloe, day: '2026-10-23', label: 'Taxi to the Mauve première', category: '6251', net: 3200, vat: null, receipt: 'TAXI CLAIRVAL 23/10 32,00 EUR' }, as(chloe)),
  )
  receipt = claimed.entry
  assert.equal((await opened(receipt)).label, 'Taxi to the Mauve première')
  const exit = await decided('exit', '2026-10-24', '2026-11-07')
  assert.deepEqual(exit.map((d) => [d.op, d.state]), [['membership:member:exit', 'settled']])
})

test('the assembly erases Chloé: her name at once; her payslips, receipts and capital account kept, restricted', async () => {
  const done = await decided('erase', '2026-11-08', '2026-11-22')
  assert.deepEqual(done.map((d) => [d.op, d.state]), [['membership:member:erase', 'settled']])
  assert.equal((await one<{ name: string }>('SELECT name FROM person.person WHERE address = $1', [chloe])).name, 'redacted')
  assert.deepEqual(await erased(chloe), { books: true, contact: false, 'expense-receipt': true, profile: false, payroll: true })
  // Kept, as the law requires, and no longer opened to readers.
  assert.ok(Number((await one<{ n: string }>(`SELECT count(*) AS n FROM payslip.payslip WHERE member = $1 AND gross IS NOT NULL`, [chloe])).n) > 0)
  assert.equal((await one<{ label: string }>(`SELECT label FROM expense.expense WHERE member = $1 AND day = '2026-10-23'`, [chloe])).label, 'Taxi to the Mauve première')
  assert.equal((await opened(receipt)).label, 'restricted')
  assert.match((await one<{ label: string }>(`SELECT label FROM account.account WHERE holder = $1`, [chloe])).label, /Chloé/)
  assert.equal(await verifies(), true)
})

test('the sweep redacts what the law kept once its clock runs out: payroll after five years, receipts and books after ten', async () => {
  await su.query(`SET cella.clock = '2031-12-31'`)
  assert.deepEqual(await all('SELECT * FROM cella.vault_sweep()'), [])
  await su.query(`SET cella.clock = '2032-01-01'`)
  assert.deepEqual(await all('SELECT subject, class, redacted FROM cella.vault_sweep()'), [{ subject: chloe, class: 'payroll', redacted: true }])
  assert.equal(Number((await one<{ n: string }>(`SELECT count(*) AS n FROM payslip.payslip WHERE member = $1 AND gross IS NOT NULL`, [chloe])).n), 0)
  assert.equal(Number((await one<{ n: string }>(`SELECT count(*) AS n FROM payslip.salary WHERE member = $1 AND gross IS NOT NULL`, [chloe])).n), 0)
  assert.equal(Number((await one<{ n: string }>(`SELECT count(*) AS n FROM timesheet.entry WHERE member = $1 AND minutes IS NOT NULL`, [chloe])).n), 0, 'her time too, in months long approved')
  await su.query(`SET cella.clock = '2037-01-01'`)
  const swept = await all<{ subject: string; class: string; keys: string; redacted: boolean }>('SELECT * FROM cella.vault_sweep() ORDER BY class')
  assert.deepEqual(swept.map((r) => [r.class, r.redacted]), [['books', true], ['expense-receipt', true]])
  assert.equal((await one<{ label: string }>(`SELECT label FROM expense.expense WHERE member = $1 AND day = '2026-10-23'`, [chloe])).label, 'redacted')
  assert.equal((await one<{ label: string }>(`SELECT label FROM account.account WHERE holder = $1`, [chloe])).label, 'redacted')
  assert.equal((await opened(receipt)).label, 'redacted')
  assert.equal(Number((await one<{ n: string }>(`SELECT count(*) AS n FROM vault.key WHERE subject = $1`, [chloe])).n), 0)
  assert.deepEqual(await erased(chloe), { books: false, contact: false, 'expense-receipt': false, profile: false, payroll: false })
  await su.query('RESET cella.clock')
})

test('the log verifies', async () => {
  assert.equal(await verifies(), true)
})
