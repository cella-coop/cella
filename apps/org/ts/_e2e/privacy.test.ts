// The privacy scenario, end to end on a seeded Lanterne, through the
// handlers: Camille erases Margaux Roux, Les Halles' contact, at her
// request; Léa gives her email and phone, then erases them herself; Chloé
// leaves, and erases her personal data herself, by her right, no motion's:
// her name at once, her payslips, time, receipts and capital account's
// label restricted until their legal clocks run out and the sweep redacts
// them. The log verifies throughout. Run by `cella test e2e privacy`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { vote } from '@cella/org-motion/api'
import { carried, close, put } from '@cella/org-graft-membership-motion/api'
import { erase as eraseContact, update } from '@cella/org-contact/api'
import { capture } from '@cella/org-expense/api'
import { log as logTime } from '@cella/org-timesheet/api'
import { forget, profile } from '@cella/org-person/api'
import { erase } from '@cella/org-membership/api'
import type { Deps } from '@cella/org-db'
import { reader, sign } from './lanterne.ts'

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

const as = (actor: string): Deps => ({ db: reader(app, actor), actor, sign: sign(actor) })
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

// Chloé's exclusion, put to the assembly: every active member on its roll
// consents, it closes and its close carries it out.
async function excluded(from: string, until: string) {
  await on(from)
  const proposed = settled(await put({ kind: 'exclude', args: { member: chloe }, deadline: until, body: '' }, as(camille))).value as { motion: string }
  const roll = await all<{ member: string }>(
    `SELECT r.member FROM membership_motion.roll r JOIN membership.member m ON m.address = r.member
     WHERE r.motion = $1 AND m.status = 'active'`,
    [proposed.motion],
  )
  for (const { member } of roll) {
    settled(await vote({ motion: proposed.motion, member, stance: 'consent' }, as(member)))
  }
  await on(until)
  settled(await close({ motion: proposed.motion }, as(camille)))
  return carried(proposed.motion, as(camille))
}

before(async () => {
  await su.connect()
  await on('2026-10-24')
})

after(async () => {
  await app.end()
  await su.end()
})

test('only a holder of erase-personal-data erases a contact: Julien may not, Camille may', async () => {
  assert.match(reason(await eraseContact({ id: margaux }, as(julien))), /erase-personal-data/)
  const done = settled(await eraseContact({ id: margaux }, as(camille)))
  assert.deepEqual(
    await one('SELECT name, email, phone, note, archived FROM contact.contact WHERE id = $1', [margaux]),
    { name: 'redacted', email: 'redacted', phone: 'redacted', note: 'redacted', archived: true },
  )
  assert.deepEqual(await erased(margaux), { contact: false })
  assert.deepEqual((await opened(done.entry)).erasure, { $erasure: { subject: margaux, erased: ['contact'], restricted: [] } })
  // The company she worked for keeps its name.
  assert.equal((await one<{ name: string }>(`SELECT name FROM contact.contact WHERE id = 'halles'`)).name, 'Les Halles Paysannes')
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

test('an active member\'s personal data is not erased: Chloé erasing her own while a member is refused', async () => {
  assert.match(reason(await erase({ member: chloe }, as(chloe))), /chloe@lanterne\.example is active: only a member who has left is erased/)
})

let receipt = 0
let time = 0

test('Chloé logs her time and claims a receipt, which the log commits to, and leaves by the assembly\'s motion', async () => {
  time = settled(await logTime({ member: chloe, day: '2026-10-23', minutes: 150, billable: false }, as(chloe))).entry
  assert.equal((await opened(time)).minutes, 150)
  const claimed = settled(
    await capture({ member: chloe, day: '2026-10-23', label: 'Taxi to the Mauve opening night', category: '6251', net: 3200, vat: null, receipt: 'TAXI CLAIRVAL 23/10 32,00 EUR' }, as(chloe)),
  )
  receipt = claimed.entry
  assert.equal((await opened(receipt)).label, 'Taxi to the Mauve opening night')
  const exit = await excluded('2026-10-24', '2026-11-07')
  assert.deepEqual(exit.map((d) => [d.op, d.state]), [['membership:member:exclude', 'settled']])
})

test('no one erases another: Julien, and Camille as manager, may not erase Chloé, who has left', async () => {
  await on('2026-11-08')
  for (const actor of [julien, camille]) {
    assert.match(reason(await erase({ member: chloe }, as(actor))), new RegExp(`${actor.replaceAll('.', '\\.')} may not erase chloe@lanterne\\.example's personal data: only their own`))
  }
  assert.equal((await one<{ name: string }>('SELECT name FROM person.person WHERE address = $1', [chloe])).name, 'Chloé Moreau')
})

test('Chloé erases her own data, by her right and no motion: her name at once; her payslips, receipts and capital account kept, restricted', async () => {
  const done = settled(await erase({ member: chloe }, as(chloe)))
  const logged = await one<{ form: Record<string, unknown> }>('SELECT form FROM cella.log WHERE n = $1', [done.entry])
  assert.equal(logged.form.motion, undefined, 'her erasure cites no motion')
  assert.equal((await one<{ name: string }>('SELECT name FROM person.person WHERE address = $1', [chloe])).name, 'redacted')
  assert.deepEqual(await erased(chloe), { books: true, contact: false, 'expense-receipt': true, profile: false, payroll: true })
  // Kept, as the law requires, and no longer opened to readers: her pay
  // and her time stay in the payslips and her timesheet, and the log
  // commits to them, but the vault opens them to no one until their five
  // years run out.
  assert.ok(Number((await one<{ n: string }>(`SELECT count(*) AS n FROM payslip.payslip WHERE member = $1 AND gross IS NOT NULL`, [chloe])).n) > 0)
  assert.equal(Number((await one<{ n: string }>(`SELECT count(*) AS n FROM timesheet.entry WHERE member = $1 AND day = '2026-10-23' AND minutes = 150`, [chloe])).n), 1)
  assert.equal((await opened(time)).minutes, 'restricted')
  assert.equal((await one<{ label: string }>(`SELECT label FROM expense.expense WHERE member = $1 AND day = '2026-10-23'`, [chloe])).label, 'Taxi to the Mauve opening night')
  assert.equal((await opened(receipt)).label, 'restricted')
  assert.match((await one<{ label: string }>(`SELECT label FROM account.account WHERE holder = $1`, [chloe])).label, /Chloé/)
  assert.equal(await verifies(), true)
})

test('the sweep redacts what the law kept once its clock runs out: payroll after five years, receipts and books after ten', async () => {
  // A sweep is no write, and the log holds none: each runs on its day, in
  // a transaction rolled back after, so the log folds into the state the
  // scenario leaves (architecture.md, "Folds").
  const dated = async (day: string, sweep: () => Promise<void>) => {
    await su.query('BEGIN')
    try {
      await su.query(`SET LOCAL cella.clock = '${day}'`)
      await sweep()
    } finally {
      await su.query('ROLLBACK')
    }
  }
  await dated('2031-12-31', async () => {
    assert.deepEqual(await all('SELECT * FROM cella.vault_sweep()'), [])
  })
  await dated('2032-01-01', async () => {
    assert.deepEqual(await all('SELECT subject, class, redacted FROM cella.vault_sweep()'), [{ subject: chloe, class: 'payroll', redacted: true }])
    assert.equal(Number((await one<{ n: string }>(`SELECT count(*) AS n FROM payslip.payslip WHERE member = $1 AND gross IS NOT NULL`, [chloe])).n), 0)
    assert.equal(Number((await one<{ n: string }>(`SELECT count(*) AS n FROM payslip.salary WHERE member = $1 AND gross IS NOT NULL`, [chloe])).n), 0)
    assert.equal(Number((await one<{ n: string }>(`SELECT count(*) AS n FROM timesheet.entry WHERE member = $1 AND minutes IS NOT NULL`, [chloe])).n), 0, 'her time too, in months long approved')
    assert.equal((await opened(time)).minutes, 'redacted')
  })
  await dated('2037-01-01', async () => {
    const swept = await all<{ subject: string; class: string; keys: string; redacted: boolean }>('SELECT * FROM cella.vault_sweep() ORDER BY class')
    assert.deepEqual(swept.map((r) => [r.class, r.redacted]), [['books', true], ['expense-receipt', true], ['payroll', true]])
    assert.equal((await one<{ label: string }>(`SELECT label FROM expense.expense WHERE member = $1 AND day = '2026-10-23'`, [chloe])).label, 'redacted')
    assert.equal((await one<{ label: string }>(`SELECT label FROM account.account WHERE holder = $1`, [chloe])).label, 'redacted')
    assert.equal((await opened(receipt)).label, 'redacted')
    assert.equal(Number((await one<{ n: string }>(`SELECT count(*) AS n FROM vault.key WHERE subject = $1`, [chloe])).n), 0)
    assert.deepEqual(await erased(chloe), { books: false, contact: false, 'expense-receipt': false, profile: false, payroll: false })
  })
})

test('the log verifies', async () => {
  assert.equal(await verifies(), true)
})
