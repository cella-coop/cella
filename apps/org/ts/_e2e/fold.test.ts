// Lanterne's year: from its seed of 24 October 2026, a year of writes
// through the handlers and the reactions the shell runs, every action the
// tree declares at least once. People keep their profiles and devices and
// are invited; the books take an import, invoices, bills, expenses, a
// payroll and the capital paid in, drawn on, repaid and withdrawn; the
// projects, their tasks, a body and a thread, and time, the files, documents and meetings go
// on; the assembly passes motions whose closes carry their effects, one
// forgoing one; the 2025 and 2026 distributions are approved and the
// year's periods closed; a member erases her data; and a year after his
// hire, Bastien applies to join. The log then names every op `cella.fold`
// registers, and folds from its founding entry into a fresh database that
// matches it row for row; no entry of the year keeps a personal figure in
// plain beside its commitment. A personal column a later write cleared
// reads null on both sides. Run by `cella test e2e fold`; the runner folds it a
// second time after this scenario, so the same comparison applies to
// every other scenario too.
import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { enrol, forget, profile, revoke } from '@cella/org-person/api'
import { accept, erase, invite, link, withdraw } from '@cella/org-membership/api'
import { apply, close, propose } from '@cella/org-graft-membership-motion/api'
import { post as message, vote } from '@cella/org-motion/api'
import { archive as archiveContact, erase as eraseContact, update as updateContact } from '@cella/org-contact/api'
import { link as bill_to } from '@cella/org-graft-contact-invoice/api'
import { link as clientOf } from '@cella/org-graft-contact-project/api'
import { link as charge } from '@cella/org-graft-invoice-project/api'
import { annul, issue, payment } from '@cella/org-graft-invoice-transaction/api'
import { send } from '@cella/org-invoice/api'
import { adjust, pay as paySupplier, post } from '@cella/org-transaction/api'
import { record as recordBill } from '@cella/org-bill/api'
import { approve as approveBill, pay as payBill } from '@cella/org-graft-bill-transaction/api'
import { capture as captureAlone, refuse, submit as claim } from '@cella/org-expense/api'
import { attach as receipt, capture } from '@cella/org-graft-expense-file/api'
import { approve as approveExpense, reimburse } from '@cella/org-graft-expense-transaction/api'
import { rebill } from '@cella/org-graft-expense-project/api'
import { add as milestone, archive, budget, complete as reach, create as createProject } from '@cella/org-project/api'
import { share } from '@cella/org-graft-membership-project/api'
import { complete, create as createTask, move, post as postComment, resolve, save as saveBody } from '@cella/org-task/api'
import { file as fileTask } from '@cella/org-graft-project-task/api'
import { assign } from '@cella/org-graft-membership-task/api'
import { approve as approveTime, correct, log as logTime, submit as submitTime } from '@cella/org-timesheet/api'
import { book } from '@cella/org-graft-project-timesheet/api'
import { hire } from '@cella/org-employment/api'
import { attach as contract } from '@cella/org-graft-employment-file/api'
import { upload } from '@cella/org-file/api'
import { attach as record } from '@cella/org-graft-file-membership/api'
import { adopt as adoptVersion, comment, create as createDocument, edit, merged, version } from '@cella/org-document/api'
import { createDoc, edits, order } from '@cella/org-body/models'
import { read } from '@cella/org-graft-document-membership/api'
import { add as item, cancel, hold, move as moveItem, remove, schedule } from '@cella/org-meeting/api'
import { table } from '@cella/org-graft-meeting-motion/api'
import { minute } from '@cella/org-graft-document-meeting/api'
import { mark, record as attended } from '@cella/org-graft-meeting-membership/api'
import { save } from '@cella/org-report/api'
import { close as closePeriod, nextPeriod, open } from '@cella/org-account/api'
import { draw, pay as payIn, repay } from '@cella/org-graft-account-membership-transaction/api'
import { spread } from '@cella/org-graft-account-membership-payslip-transaction/api'
import { generate } from '@cella/org-graft-payslip-timesheet/api'
import { approve as approveRun, pay as payRun } from '@cella/org-graft-payslip-transaction/api'
import { approve as approveSplit, draft } from '@cella/org-patronage/api'
import type { Deps } from '@cella/org-db'
import { fixture, generate as device, random, sha256, signer } from '@cella/org-sign'
import { folded, tables, unfold } from './fold.ts'
import { reading } from './port.ts'
import { reader, scope, sign } from './lanterne.ts'
import { reacting } from '../src/lib/server/slices.ts'
import { imported } from '../src/lib/server/feats/import.ts'

const db = process.env.PGDATABASE ?? 'cella'
const su = new pg.Client({ database: db })
let app: pg.Client | undefined

const camille = 'camille@lanterne.example'
const julien = 'julien@lanterne.example'
const hugo = 'hugo@lanterne.example'
const thomas = 'thomas@lanterne.example'
const yusuf = 'yusuf@lanterne.example'
const malik = 'malik@lanterne.example'
const amina = 'amina@lanterne.example'
const chloe = 'chloe@lanterne.example'
const sofia = 'sofia@lanterne.example'
const lea = 'lea@lanterne.example'
const ines = 'ines@lanterne.example'
const paul = 'paul@lanterne.example'
const nadia = 'nadia@lanterne.example'
const yara = 'yara@lanterne.example'
const bastien = 'bastien@lanterne.example'
// Each signs from the laptop their invitation or hire enrols.
const newcomers = [ines, nadia, yara, bastien]

async function on(date: string) {
  await su.query(`ALTER ROLE cella_app IN DATABASE ${su.escapeIdentifier(db)} SET cella.clock = '${date}'`)
  await app?.end()
  app = new pg.Client({ database: db, user: 'cella_app' })
  await app.connect()
}

const as = (actor: string): Deps =>
  reacting({ db: reader(app as pg.Client, actor), actor, sign: newcomers.includes(actor) ? signer(scope, actor, fixture(actor, 'laptop')) : sign(actor) })
const all = async <R>(sql: string, values: unknown[] = []) => (await su.query(sql, values)).rows as R[]
const one = async <R>(sql: string, values: unknown[] = []) => (await all<R>(sql, values))[0]
const reason = (out: { state: string; reason?: string }) => (out.state === 'refused' ? out.reason ?? '' : '')
const settled = <T>(out: { state: string; value?: T; reason?: string }): T => {
  assert.equal(out.state, 'settled', reason(out))
  return out.value as T
}
const pdf = (text: string) => ({ name: `${text.replace(/\W+/g, '-')}.pdf`, type: 'application/pdf', bytes: new TextEncoder().encode(`%PDF-1.4\n% ${text}\n%%EOF\n`) })
const sample = async (name: string) => {
  const { readFileSync } = await import('node:fs')
  return new Uint8Array(readFileSync(new URL(`../../fixtures/lanterne/import/${name}`, import.meta.url)))
}

type Action = { kind: string; args: Record<string, string | number> }
// A motion of `circle` that every member on its roll consents to, closed
// on its deadline by Camille, the close carrying what it decides: its id.
const motions = new Map<string, string>()
async function proposed(name: string, circle: string, title: string, actions: Action[], deadline: string) {
  const { motion } = settled(await propose({ circle, title, procedure: 'consent', deadline, body: '', actions }, as(camille))) as { motion: string }
  for (const { member } of await all<{ member: string }>(
    `SELECT r.member FROM motion.roll r JOIN membership.member m ON m.address = r.member WHERE r.motion = $1 AND m.status = 'active'`,
    [motion],
  )) {
    settled(await vote({ motion, member, stance: 'consent' }, as(member)))
  }
  motions.set(name, motion)
  return motion
}
const closed = async (name: string) => settled(await close({ motion: motions.get(name) ?? '' }, as(camille)))

const capitalRule = (minimum: number) =>
  `A share is worth {account_share: 50 € | more is stricter}. Each associate subscribes at least {account_minimum: ${minimum} | more is stricter} shares, ` +
  'and may pay them in at most {account_instalments: 10 | less is stricter} monthly instalments. An associate who leaves is repaid their shares ' +
  'at their nominal value from {account_delay: 12 | more is stricter} months after the exit, in {account_repayments: 3 | more is stricter} yearly repayments'
const workRule =
  'The work share is divided among the workers {patronage_salary: 60 % | more is stricter} in proportion to pay, ' +
  '{patronage_hours: 40 % | more is stricter} to time worked and {patronage_equal: 0 % | more is stricter} in equal parts. ' +
  "{patronage_capital: 50 % | more is stricter} of each associate's part is employed in shares of the capital, and the capital earns " +
  'interest of at most {patronage_interest: 3.5 % | less is stricter} a year'

let started = 0
let head = 0

before(async () => {
  await su.connect()
  await on('2026-10-24')
  started = performance.now()
})

after(async () => {
  await app?.end()
  await su.end()
})

test('24 October: people keep their profiles and devices, Nadia and Yara are invited, and the books take October\'s FEC', async () => {
  settled(await profile({ person: hugo, phone: '+33 6 00 00 00 03' }, as(hugo)))
  const phone = await device(chloe)
  settled(await enrol({ address: chloe, label: 'phone', key: phone.key }, as(chloe)))
  settled(await revoke({ key: phone.key }, as(chloe)))
  const secret = random()
  settled(await invite({ address: nadia, name: 'Nadia Benali', link: await sha256(secret) }, as(thomas)))
  settled(await accept({ member: nadia, secret, key: (await fixture(nadia, 'laptop')).key, label: 'laptop' }, as(nadia)))
  settled(await invite({ address: yara, name: 'Yara Haddad' }, as(thomas)))
  settled(await link({ member: yara, link: await sha256(random()) }, as(thomas)))
  for (const [kind, name, by] of [
    ['fec', 'fec-2026-10.txt', julien],
    ['contacts', 'contacts.csv', camille],
    ['projects', 'projects.csv', camille],
    ['tasks', 'tasks.csv', camille],
  ]) {
    const { done } = await imported(as(by), kind, name, await sample(name), false)
    assert.equal(done.state, 'settled', `${kind}: ${done.reason ?? ''}`)
  }
})

test('24 October: contacts are kept, archived and erased, and the work goes on: a project, its milestones, tasks, a body and a thread, time and files', async () => {
  settled(await updateContact({ id: 'nuvola', fields: { note: 'Renews in January' } }, as(chloe)))
  settled(await archiveContact({ id: 'velo' }, as(camille)))
  settled(await eraseContact({ id: 'halles-roux' }, as(camille)))
  const { project } = settled(await createProject({ title: 'Terres d\'Oc, label refresh', circle: 'brand', summary: 'A new label range' }, as(hugo))) as { project: string }
  settled(await clientOf({ project, contact: 'terres' }, as(hugo)))
  settled(await budget({ project, amount: 8_000_00 }, as(hugo)))
  settled(await share({ project, member: sofia, amount: 2_000_00 }, as(hugo)))
  settled(await milestone({ project, title: 'Proofs approved', due: '2026-11-20' }, as(hugo)))
  settled(await reach({ project, n: 1 }, as(hugo)))
  const { task } = settled(await createTask({ title: 'Redraw the vine', priority: 'high', due: '2026-11-06' }, as(sofia))) as { task: string }
  settled(await fileTask({ task, project }, as(hugo)))
  settled(await assign({ task, member: sofia }, as(hugo)))
  settled(await move({ task, status: 'doing' }, as(sofia)))
  const notes = createDoc()
  edits.paste(notes, undefined, 0, [{ type: 'todo', checked: false, runs: [{ text: 'Send the redrawn vine to the printer' }], children: [] }])
  notes.commit()
  settled(await saveBody({ task, snapshot: notes.export({ mode: 'snapshot' }), contributors: [sofia] }, as(sofia)))
  settled(await complete({ task }, as(sofia)))
  const { comment: root } = settled(await postComment({ task, parent: null, text: `@[${hugo}] the vine is redrawn: does it print?` }, as(sofia))) as { comment: number }
  settled(await postComment({ task, parent: root, text: 'It prints well.' }, as(hugo)))
  settled(await resolve({ comment: root, resolved: true }, as(sofia)))
  const { entry } = settled(await logTime({ member: thomas, day: '2026-10-23', minutes: 90, billable: true, note: 'Proofs for the Halles shop' }, as(thomas))) as { entry: string }
  settled(await correct({ entry, minutes: 60 }, as(thomas)))
  settled(await book({ member: sofia, day: '2026-10-23', minutes: 120, billable: true, project }, as(sofia)))
  settled(await upload({ class: 'none', subject: null, ...pdf('reglement interieur v3') }, as(thomas)))
  settled(await record({ member: camille, file: { class: 'profile', subject: camille, ...pdf('rib') } }, as(camille)))
  settled(await contract({ worker: ines, file: { class: 'payroll', subject: ines, ...pdf('avenant 1') } }, as(camille)))
  settled(await archive({ project: 'clairval-site' }, as(camille)))
  motions.set('project', project)
})

test('24 October: an invoice is issued, billed, sent, charged, paid and another voided; an entry posted and corrected, a supplier paid; a bill and expenses run their course', async () => {
  const project = motions.get('project') ?? ''
  const lines = [{ description: 'Label redraw, days', quantity: '2', unit_price: 520_00, vat_rate: 2000 }]
  const { invoice } = settled(await issue({ series: 'F-2026', bill_to: 'Terres d\'Oc', bill_address: '2 place du Marché\n34000 Montpellier', label: 'Label refresh', lines }, as(julien))) as { invoice: string }
  settled(await bill_to({ invoice, contact: 'terres' }, as(julien)))
  settled(await send({ invoice }, as(julien)))
  settled(await charge({ invoice, project }, as(julien)))
  settled(await payment({ invoice, at: '2026-10-24', amount: 1248_00, reference: 'VIR-TERRES-1024' }, as(julien)))
  const wrong = settled(await issue({ series: 'F-2026', bill_to: 'Atelier Ondine', bill_address: '11 rue Kléber\n93100 Montreuil', label: 'Shop upkeep', lines }, as(julien))) as { invoice: string }
  settled(await annul({ invoice: wrong.invoice, reason: 'issued to the wrong client' }, as(julien)))
  const posted = settled(await post({ date: '2026-10-24', label: 'Supplies, October', lines: [{ account: '606', side: 'debit', cents: 12_00 }, { account: '401', side: 'credit', cents: 12_00 }] }, as(julien))) as { entry: string }
  settled(await adjust({ corrects: posted.entry, base: null, entry: { date: '2026-10-24', label: `Supplies, October, corrected (${posted.entry})`, lines: [{ account: '401', side: 'debit', cents: 2_00 }, { account: '606', side: 'credit', cents: 2_00 }] } }, as(julien)))
  settled(await paySupplier({ date: '2026-10-24', label: 'Paper for the proofs', cents: 80_00 }, as(julien)))
  const { bill } = settled(await recordBill({
    supplier: 'Logiciels Vauban',
    reference: 'LV-26-0412',
    issued: '2026-10-22',
    label: 'Design licences, October',
    category: '626',
    lines: [{ description: 'Layout seat, a month', quantity: '3', unit_price: 59_99, vat_rate: 2000 }],
  }, as(julien))) as { bill: string }
  settled(await approveBill({ bill }, as(camille)))
  settled(await payBill({ bill }, as(julien)))
  const train = settled(await capture({ member: thomas, day: '2026-10-23', label: 'Train to Clairval', category: '6251', net: 78_55, vat: 7_85, receipt: null, file: { class: 'expense-receipt', subject: thomas, ...pdf('sncf 1023') } }, as(thomas))) as { expense: string }
  settled(await claim({ expense: train.expense }, as(thomas)))
  settled(await approveExpense({ expense: train.expense }, as(camille)))
  settled(await reimburse({ expense: train.expense }, as(julien)))
  const ink = settled(await captureAlone({ member: sofia, day: '2026-10-23', label: 'Ink for the proofs', category: '606', net: 40_00, vat: 8_00, receipt: null }, as(sofia))) as { expense: string }
  settled(await receipt({ expense: ink.expense, file: { class: 'expense-receipt', subject: sofia, ...pdf('ink') } }, as(sofia)))
  settled(await claim({ expense: ink.expense }, as(sofia)))
  settled(await rebill({ expense: ink.expense, project }, as(sofia)))
  const taxi = settled(await captureAlone({ member: lea, day: '2026-10-23', label: 'Taxi, no receipt', category: '6251', net: 30_00, vat: null, receipt: null }, as(lea))) as { expense: string }
  settled(await claim({ expense: taxi.expense }, as(lea)))
  settled(await refuse({ expense: taxi.expense }, as(camille)))
})

test('24 October: documents are written, versioned, commented and read; a report is saved', async () => {
  const { document } = settled(await createDocument({ title: 'Studio handbook', circle: 'ag', blocks: [{ type: 'paragraph', runs: [{ text: 'How the studio works' }], children: [] }] }, as(camille))) as { document: string }
  const draft = await merged(app as pg.Client, document)
  const from = draft.version()
  const last = order(draft).at(-1)
  assert.ok(last, 'the handbook opens with a block')
  edits.after(draft, last.id, 'paragraph', {}, [{ text: 'The studio opens at nine.' }])
  draft.commit()
  settled(await edit({ document, update: draft.export({ mode: 'update', from }) }, as(camille)))
  const { version: saved } = settled(await version({ document }, as(camille))) as { version: string }
  settled(await comment({ version: saved, quote: 'opens at nine', text: 'Half past, in winter?' }, as(hugo)))
  settled(await read({ member: lea, version: saved }, as(lea)))
  motions.set('handbook', saved)
  const analytics = await reading(su, 47, '2026-10-24')
  try {
    const definition = { from: { e: 'expense.expenses' }, fields: ['e.id', 'e.circle'], order: ['e.id'] }
    settled(await save(analytics.analytics, { id: 'expenses-by-id', title: 'Expenses by id', caption: '', definition }, as(chloe)))
  } finally {
    analytics.analytics.close()
    analytics.stop()
  }
})

test('24 October: the assembly and coordination put their motions, which are discussed and tabled at coordination\'s meeting', async () => {
  const adopts = (await one<{ policy: string }>(`SELECT policy FROM circle.mandate WHERE grantee = 'coordination' AND power = 'adopt-document'`)).policy
  const founding = (await one<{ policy: string }>(`SELECT policy FROM account.terms WHERE id = 'm-2021-001-43'`)).policy
  const patronage = (await one<{ policy: string }>(`SELECT policy FROM patronage.terms ORDER BY id LIMIT 1`)).policy
  await proposed('assembly', 'ag', 'Admit Nadia, create Design, amend Web and its roles, adopt the handbook and the new terms', [
    { kind: 'admit', args: { member: nadia, shares: 20 } },
    { kind: 'circle', args: { id: 'design', name: 'Design', purpose: 'product and service design' } },
    { kind: 'seat', args: { circle: 'design', member: sofia } },
    { kind: 'amend-circle', args: { circle: 'web', purpose: 'the studio\'s websites' } },
    { kind: 'role', args: { circle: 'web', id: 'editor', name: 'Editor', duty: 'edits the studio\'s copy', holders: 1 } },
    { kind: 'seat', args: { circle: 'web', member: sofia, role: 'editor' } },
    { kind: 'amend-role', args: { role: 'print-buyer', duty: 'orders Brand\'s print and paper' } },
    { kind: 'policy', args: { kind: 'rule', wording: capitalRule(20), replaces: founding } },
    { kind: 'policy', args: { kind: 'rule', wording: workRule, from: '2027-01-01', replaces: patronage } },
    { kind: 'end', args: { policy: adopts } },
    { kind: 'adopt', args: { version: motions.get('handbook') ?? '' } },
  ], '2026-10-31')
  await proposed('finance', 'coordination', 'Finance sits in Brand', [{ kind: 'seat-role', args: { circle: 'brand', role: 'finance' } }], '2026-10-31')
  await proposed('exclusion', 'ag', 'Exclude Malik', [{ kind: 'exclude', args: { member: malik } }], '2026-11-07')
  settled(await message({ motion: motions.get('assembly') ?? '', member: yusuf, reply: null, body: 'Design needs its own circle.' }, as(yusuf)))
  const { meeting } = settled(await schedule({ circle: 'coordination', title: 'Coordination', day: '2026-10-24', time: '10:00', place: 'Studio' }, as(camille))) as { meeting: string }
  const items = []
  for (const [title, by] of [['Pipeline', camille], ['Staffing for November', yusuf]]) {
    items.push(settled(await item({ meeting, title, presenter: 'Camille', minutes: 15 }, as(by))) as { item: number })
  }
  settled(await table({ meeting, motion: motions.get('finance') ?? '', title: '', presenter: 'Camille', minutes: 10 }, as(camille)))
  settled(await moveItem({ meeting, item: items[1].item, to: 0 }, as(camille)))
  settled(await remove({ meeting, item: items[0].item }, as(camille)))
  settled(await mark({ meeting, member: yusuf, status: 'present' }, as(yusuf)))
  settled(await attended({ meeting, member: camille, status: 'present' }, as(malik)))
  settled(await hold({ meeting }, as(malik)))
  settled(await minute({ meeting }, as(malik)))
  const later = settled(await schedule({ circle: 'coordination', title: 'Coordination, moved', day: '2026-11-09', time: '10:00' }, as(camille))) as { meeting: string }
  settled(await cancel({ meeting: later.meeting }, as(camille)))
})

test('31 October: the closes carry Inès\'s and Nadia\'s admissions, their subscriptions, the new terms, Design, Web\'s purpose and Editor role, the print buyer\'s duty and the handbook; Inès spreads hers and Nadia pays hers in', async () => {
  await on('2026-10-31')
  settled(await close({ motion: 'm-2026-012' }, as(camille)))
  await closed('assembly')
  settled(await adoptVersion({ document: (motions.get('handbook') ?? '').split('@')[0], version: motions.get('handbook') ?? '', base: null, motion: motions.get('assembly') ?? '' }, as(camille)))
  await closed('finance')
  settled(await spread({ member: ines, instalments: 10 }, as(ines)))
  settled(await payIn({ member: nadia, cents: 1_000_00 }, as(julien)))
  await proposed('unseat', 'coordination', 'Finance leaves Brand', [{ kind: 'unseat-role', args: { circle: 'brand', role: 'finance' } }], '2026-11-07')
  await proposed('suspension', 'ag', 'Suspend Malik and Chloé, and unseat Sofia from Design', [
    { kind: 'suspend', args: { member: malik } },
    { kind: 'suspend', args: { member: chloe } },
    { kind: 'unseat', args: { circle: 'design', member: sofia } },
  ], '2026-11-08')
})

test('2 November: October\'s time is approved and its pay run paid; Thomas draws on his account; the 2025 distribution is approved; Bastien is hired; October closes', async () => {
  await on('2026-11-02')
  for (const { member, circle, submitted } of await all<{ member: string; circle: string; submitted: string | null }>(
    `SELECT p.member, p.circle, p.submitted FROM timesheet.period p WHERE p.month = '2026-10' AND p.member IN (SELECT member FROM payslip.salary WHERE "from" <= '2026-10-01') ORDER BY p.member, p.circle`,
  )) {
    if (!submitted) settled(await submitTime({ member, month: '2026-10', circle }, as(member)))
    settled(await approveTime({ member, month: '2026-10', circle }, as(member === camille ? julien : camille)))
  }
  settled(await generate({ month: '2026-10' }, as(julien)))
  settled(await approveRun({ month: '2026-10' }, as(camille)))
  settled(await payRun({ month: '2026-10' }, as(julien)))
  settled(await draw({ member: thomas, cents: 300_00 }, as(thomas)))
  settled(await approveSplit({ distribution: '2025', motion: 'm-2026-006' }, as(camille)))
  const laptop = await fixture(bastien, 'laptop')
  settled(await hire({ worker: bastien, name: 'Bastien Roux', job: 'apprentice developer', contract: 'apprenticeship', start: '2026-11-02', until: '2028-08-31', minutes: 35 * 60, key: laptop.key, label: 'laptop' }, as(camille)))
  settled(await open(await nextPeriod(app as pg.Client), as(julien)))
  settled(await closePeriod({ month: '2026-10' }, as(julien)))
})

test('November: Malik is excluded, his capital frozen and withdrawn; the motion suspending him forgoes it, suspends Chloé and unseats Sofia from Design; Amina withdraws with her capital; Paul is repaid', async () => {
  await on('2026-11-07')
  await closed('exclusion')
  await closed('unseat')
  await on('2026-11-08')
  const before = Number((await one<{ n: string }>('SELECT n FROM cella.head')).n)
  await closed('suspension')
  const carried = await all<{ op: string; settled: boolean }>('SELECT op, settled FROM cella.log WHERE n > $1 ORDER BY n', [before])
  assert.deepEqual(carried.map((e) => [e.op, e.settled]), [
    ['motion:motion:close', true],
    ['membership:member:suspend', false],
    ['membership:member:suspend', true],
    ['circle:seat:remove', true],
  ], 'the close stands, forgoing the suspension of a member excluded since')
  await on('2026-11-09')
  settled(await withdraw({ member: amina }, as(amina)))
  await on('2026-11-30')
  settled(await repay({ member: paul, n: 1 }, as(julien)))
})

test('January: the year\'s periods close, the 2026 split is drafted, moved and approved, and the credits follow; Amina erases her data and Hugo his profile\'s', async () => {
  await on('2026-12-01')
  settled(await open({ month: '2027-01' }, as(julien)))
  await on('2027-01-15')
  for (const { month } of await all<{ month: string }>(`SELECT month FROM account.period WHERE month < '2027' AND closed IS NULL ORDER BY month`)) {
    settled(await closePeriod({ month }, as(julien)))
  }
  settled(await draft({ year: 2026, surplus: 50_000_00, work: 45_00, legal: 15_00, development: 39_50, interest: 50 }, as(julien)))
  await proposed('split', 'ag', 'Approve the 2026 distribution', [{ kind: 'distribution', args: { distribution: '2026' } }], '2027-01-29')
  await on('2027-01-29')
  await closed('split')
  settled(await approveSplit({ distribution: '2026', motion: motions.get('split') ?? '' }, as(camille)))
  settled(await erase({ member: amina }, as(amina)))
  settled(await forget({ person: hugo }, as(hugo)))
})

test('a year after his hire, Bastien applies by his right, and his candidacy opens', async () => {
  await on('2027-11-02')
  settled(await apply({ member: bastien, shares: 20, deadline: '2027-11-16', body: 'I have worked with the co-op for a year and ask to join.' }, as(bastien)))
  head = Number((await one<{ n: string }>('SELECT n FROM cella.head')).n)
  console.log(`# the year wrote ${head - 1} entries in ${((performance.now() - started) / 1000).toFixed(1)}s`)
})

test('no entry the year writes carries a personal figure in plain beside its commitment', async () => {
  // Each figure a commitment of the entry opens to, and every number its
  // payload keeps in plain, outside its commitments.
  const figures = (form: unknown, open: unknown, into: Set<number>) => {
    if (form && typeof form === 'object' && '$commit' in form) {
      if (typeof open === 'number') into.add(open)
    } else if (form && typeof form === 'object') {
      for (const [k, v] of Object.entries(form)) figures(v, (open as Record<string, unknown> | null)?.[k], into)
    }
    return into
  }
  const plain = (form: unknown, into: Set<number>) => {
    if (typeof form === 'number') into.add(form)
    else if (form && typeof form === 'object' && !('$commit' in form)) for (const v of Object.values(form)) plain(v, into)
    return into
  }
  const found: string[] = []
  for (const e of await all<{ n: string; op: string; form: unknown; open: unknown }>(
    'SELECT n, op, form, cella.opened(n) AS open FROM cella.log WHERE n > 1 AND settled ORDER BY n',
  )) {
    const shown = plain(e.form, new Set())
    for (const figure of figures(e.form, e.open, new Set())) {
      if (shown.has(figure)) found.push(`${e.op} (entry ${e.n}) keeps ${figure} in plain beside its commitment`)
    }
  }
  assert.deepEqual(found, [])
})

test('its log names every op cella.fold registers, and folds from its founding into a fresh scope, every state table exactly', async () => {
  const { rows: [first] } = await su.query<{ op: string }>('SELECT op FROM cella.log WHERE n = 1')
  assert.equal(first.op, 'membership-motion:scope:found')
  const missed = await all<{ op: string }>('SELECT DISTINCT op FROM cella.fold EXCEPT SELECT op FROM cella.log WHERE settled ORDER BY op')
  assert.deepEqual(missed.map((r) => r.op), [], 'the year writes every action the tree declares')
  try {
    const t = performance.now()
    assert.match(folded(db), /matches .* row for row, state [0-9a-f]+/)
    console.log(`# folded ${head} entries in ${((performance.now() - t) / 1000).toFixed(1)}s`)
    const [actual, rebuilt] = await Promise.all([tables(db), tables(`${db}_fold`)])
    assert.ok(Object.keys(actual).length > 0, 'the comparison covers state tables')
    assert.deepEqual(rebuilt, actual)
  } finally {
    await unfold(db)
  }
})

test('Léa gives her email and clears it, and the state hash reads it as null in her scope and in its fold', async () => {
  await on('2027-11-02')
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
      settled(await profile({ person: lea, email: given }, as(lea)))
    }
    assert.equal((await su.query('SELECT email FROM person.person WHERE address = $1', [lea])).rows[0].email, null)
    assert.ok((await su.query(`SELECT FROM vault.secret WHERE field = 'person.person.email' AND subject = $1`, [lea])).rowCount, 'the vault keeps the email given before')
    assert.match(folded(db), /matches .* row for row, state [0-9a-f]+/)
    assert.equal(await email(db), null)
    assert.equal(await email(`${db}_fold`), null)
  } finally {
    await unfold(db)
  }
})
