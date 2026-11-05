// The reading scenario, end to end on a seeded Lanterne, through the built
// shell outside dev mode, each page read as a signed-in member: reading
// follows the mandates, so Inès, in Web and no member, reads Web's
// expenses and not Marketing's, Chloé, a member, every circle's by open
// books, and Web's lead Web's time alone; Chloé, a
// designer holding no power over pay or the books, reads her own pay and
// capital and no colleague's; Julien, in finance, reads everyone's; what
// sums the whole, the statements, an entry's amount and a share the 2025
// surplus would give, is the same whoever reads it; a member's personal
// values in the log open to them, never to a colleague; what a function
// reading as its owner returns, a share that divides the whole or a
// motion's count, is kept to whoever reads it, so Inès and Paul, who
// left, read nothing of a record another circle owns through one, nor
// through a view the app reads, which reads as its reader, an expense's
// claim or a document's adoption among them; a saved report reads for
// whoever runs it, through the analytics shell;
// and a server logging in as the superuser reads as the app role all the
// same. Run by `cella test e2e reading`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { profile } from '@cella/org-person/api'
import { scoped } from '@cella/org-analytics'
import { custom, save } from '@cella/org-report/api'
import { reading as opened, type Reading } from './port.ts'
import { Shell } from './serve.ts'
import { reader, sign } from './lanterne.ts'

const su = new pg.Client()
const shell = new Shell(su)
let app: pg.Client
let analytics: Reading

const camille = 'camille@lanterne.example'
const chloe = 'chloe@lanterne.example'
const ines = 'ines@lanterne.example'
const julien = 'julien@lanterne.example'
const lea = 'lea@lanterne.example'
const paul = 'paul@lanterne.example'
const yusuf = 'yusuf@lanterne.example'

const page = async (path: string, actor: string) => {
  const p = await shell.page(path, actor)
  return { status: p.status, text: p.text }
}

// Raw queries on the app's role, reading as `actor`.
const reading = async (actor: string, sql: string, values: unknown[] = []) => {
  await app.query(`SELECT set_config('cella.actor', $1, false)`, [actor])
  return (await app.query(sql, values)).rows
}

before(async () => {
  await su.connect()
  analytics = await opened(su, 40, '2026-10-24')
  await shell.start('2026-10-24', analytics.env)
  app = new pg.Client({ user: 'cella_app' })
  await app.connect()
})

after(async () => {
  await app.end()
  await shell.stop()
  analytics?.stop()
  await su.end()
})

test('a worker reads their own payslips and no colleague\'s; finance reads every one', async () => {
  const own = await page('/payslips', chloe)
  assert.equal(own.status, 200)
  assert.ok(own.text.includes(`2026-09~${chloe}`), 'Chloé reads her September payslip')
  assert.ok(!own.text.includes(`~${camille}`), 'and not Camille\'s')
  assert.equal((await page(`/payslips/2026-09~${camille}`, chloe)).status, 404, 'a colleague\'s payslip is none to her')

  const all = await page('/payslips', julien)
  for (const member of [camille, chloe, julien]) {
    assert.ok(all.text.includes(`2026-09~${member}`), `Julien reads ${member}'s`)
  }
  assert.equal((await page(`/payslips/2026-09~${camille}`, julien)).status, 200)
})

test('reading follows the mandates: Inès reads Web\'s expenses and not Marketing\'s, Chloé every circle\'s by open books, and her own pay and not Yusuf\'s', async () => {
  const scoped = await page('/expenses', ines)
  assert.equal(scoped.status, 200)
  assert.ok(scoped.text.includes('ex-0002'), 'Inès, in Web, reads Web\'s expense by read on her own circle')
  assert.ok(scoped.text.includes('ex-0004'), 'and the assembly\'s, the whole co-op\'s')
  assert.ok(!scoped.text.includes('ex-0003'), 'and not Marketing\'s: no member, she holds no open books')
  assert.equal((await page('/expenses/ex-0003', ines)).status, 404, 'Marketing\'s expense is none to her')
  assert.deepEqual(await reading(ines, `SELECT id FROM expense.expense WHERE circle = 'marketing'`), [], 'and a direct query as the app role reads none of Marketing\'s')

  const expenses = await page('/expenses', chloe)
  for (const id of ['ex-0002', 'ex-0003', 'ex-0004']) {
    assert.ok(expenses.text.includes(id), `Chloé, a member, reads ${id} by open books`)
  }
  assert.equal((await page('/expenses/ex-0002', chloe)).status, 200, 'Web\'s expense among them')
  assert.equal((await page('/expenses/ex-0002', camille)).status, 200, 'the gérante, approving every circle\'s expenses, reads it')

  const pay = await page('/payslips', chloe)
  assert.ok(pay.text.includes(`2026-09~${chloe}`) && !pay.text.includes(`~${yusuf}`), 'she reads her own pay and not Yusuf\'s')
  assert.deepEqual(await reading(chloe, 'SELECT member FROM payslip.payslip WHERE member = $1', [yusuf]), [], 'a direct query as the app role for Yusuf\'s pay returns no row')
  assert.deepEqual(await reading(chloe, 'SELECT member FROM payslip.salary WHERE member <> $1', [chloe]), [], 'nor for anyone\'s salary but hers: read opens no pay')

  const sql = `SELECT id, amount FROM account_transaction.statement('balance', NULL, '2026-09-30') ORDER BY n`
  for (const member of [chloe, lea, yusuf]) {
    assert.deepEqual(await reading(member, sql), await reading(julien, sql), `${member} reads the year's accounts whole`)
  }

  // Time reads by the scope of the mandate that approves it: Web's lead
  // approves Web's alone, so reads Web's alone beside their own.
  const time = await reading(yusuf, 'SELECT DISTINCT circle FROM timesheet.entry WHERE member <> $1 ORDER BY circle', [yusuf])
  assert.deepEqual(time, [{ circle: 'web' }], 'Yusuf reads his circle\'s time and no other\'s')
  const everyone = await reading(julien, 'SELECT DISTINCT circle FROM timesheet.entry ORDER BY circle')
  assert.ok(everyone.length > 1, 'the Treasurer, approving everyone\'s, reads every circle\'s')
})

test('a saved report reads for whoever runs it: Inès reads Web\'s and the assembly\'s expenses through it, and Paul, whose seat went, none', async () => {
  const definition = { from: { e: 'expense.expenses' }, fields: ['e.id', 'e.circle'], order: ['e.id'] }
  const saved = await save(analytics.analytics, { id: 'expenses-by-id', title: 'Expenses by id', caption: '', definition }, { db: reader(app, chloe), actor: chloe, sign: sign(chloe) })
  assert.equal(saved.state, 'settled', saved.state === 'refused' ? saved.reason : '')

  const hers = await page('/reports/expenses-by-id', chloe)
  assert.equal(hers.status, 200)
  for (const id of ['ex-0001', 'ex-0002', 'ex-0003', 'ex-0004']) {
    assert.ok(hers.text.includes(id), `Chloé, a member, reads ${id} through her report by open books`)
  }
  const web = await page('/reports/expenses-by-id', ines)
  assert.equal(web.status, 200)
  assert.ok(web.text.includes('ex-0002') && web.text.includes('ex-0004'), 'Inès reads Web\'s and the assembly\'s through Chloé\'s report')
  assert.ok(!web.text.includes('ex-0001') && !web.text.includes('ex-0003'), 'and not Brand\'s or Marketing\'s, as on the expenses\' page')
  // Paul exited, and his seat in the assembly went with his device: the
  // port the server hands a page, run as him, reads none of it.
  const run = async (actor: string) => (await custom(scoped(analytics.analytics, reader(app, actor)), definition)).custom.result.rows
  assert.deepEqual(await run(paul), [], 'Paul, whose seat in the assembly went when he exited, reads none')
  assert.ok((await run(chloe)).length >= 4, 'where Chloé reads every one')
})

test('a worker reads their own capital account and its lines, and no colleague\'s; finance reads every one', async () => {
  // Camille's capital account is 101301 and Chloé's 101310.
  const accounts = await page('/accounts', chloe)
  assert.ok(accounts.text.includes('101310'), 'Chloé reads her capital account')
  assert.ok(!accounts.text.includes('101301'), 'and not Camille\'s')
  assert.ok(accounts.text.includes('Banque'), 'the co-op\'s own accounts are every member\'s')
  assert.ok(accounts.text.includes('trial balance agrees'), 'and the whole trial balance agrees for her, as it does')
  assert.ok(!(await page(`/people/${camille}`, chloe)).text.includes('101301'), 'Camille\'s page shows her no capital of Camille\'s')

  // The opening balances carry every member's capital: Chloé reads the
  // entry and its lines on the co-op's own accounts and on her own.
  const opening = await page('/journal/je-0001', chloe)
  assert.equal(opening.status, 200)
  assert.ok(opening.text.includes('101310') && !opening.text.includes('101301'))

  const books = await page('/accounts', julien)
  assert.ok(books.text.includes('101301') && books.text.includes('101310'), 'Julien reads every capital account')
  assert.ok((await page('/journal/je-0001', julien)).text.includes('101301'))
})

test('what sums the whole is the same whoever reads it: the statements, an entry\'s amount, a share of the surplus', async () => {
  const sql = `SELECT id, amount FROM account_transaction.statement('balance', NULL, '2026-09-30') ORDER BY n`
  assert.deepEqual(await reading(chloe, sql), await reading(julien, sql))
  const equity = (await reading(chloe, sql)).find((r) => r.id === 'capital')
  assert.ok(equity && Number(equity.amount) > 0, 'the capital rubric sums every member\'s capital for Chloé too')

  const amount = `SELECT transaction.amount('je-0001') AS a`
  assert.deepEqual(await reading(chloe, amount), await reading(julien, amount), 'the opening entry\'s amount counts the lines she may not read')

  // What each project burnt, spent and invoiced sums every entry, expense
  // and invoice on it, whoever reads it: Chloé's time on a project is a
  // part of it, never the whole.
  for (const sql of [
    'SELECT project, hours, billable, spent, cost FROM project_timesheet.burn ORDER BY project',
    'SELECT project, expenses, approved, pending FROM expense_project.spent ORDER BY project',
    'SELECT project, net FROM invoice_project.invoiced ORDER BY project',
  ]) {
    const whole = await reading(julien, sql)
    assert.ok(whole.length > 0, sql)
    for (const member of [chloe, ines]) {
      assert.deepEqual(await reading(member, sql), whole, `${member} reads the same as Julien: ${sql}`)
    }
  }

  // The 2025 surplus, not yet approved: what its work share would give
  // each worker by pay.
  const shares = `SELECT member, amount FROM patronage_payslip.work_share WHERE distribution = '2025' ORDER BY member`
  const everyone = await reading(julien, shares)
  assert.equal(everyone.length, 10, 'Julien, who distributes the surplus, reads every worker\'s share')
  assert.deepEqual(await reading(chloe, shares), everyone.filter((s) => s.member === chloe), 'Chloé reads her own, the same as Julien reads it')
})

test('a function reading as its owner keeps its rows to whoever reads them: Inès, in Web and no member, and Paul, who left, read nothing of another\'s', async () => {
  // A share that needs the whole to divide: each worker's part of the 2025
  // surplus, by pay and by time.
  for (const fn of ['patronage_payslip.division', 'patronage_timesheet.division']) {
    const sql = `SELECT DISTINCT worker FROM ${fn}('2025') ORDER BY worker`
    for (const member of [ines, paul]) {
      const read = (await reading(member, sql)).map((r) => r.worker)
      assert.ok(read.every((w) => w === member), `${member} reads through ${fn} no part but their own: ${read.join(', ')}`)
    }
    const own = (await reading(chloe, sql)).map((r) => r.worker)
    assert.ok(own.every((w) => w === chloe), `Chloé, holding no power over pay, reads through ${fn} her own part alone`)
  }
  const pay = await reading(julien, `SELECT DISTINCT worker FROM patronage_payslip.division('2025')`)
  assert.equal(pay.length, 10, 'Julien, who distributes the surplus, reads every worker\'s part by pay')

  // A motion's count, of Coordination's open motion on the rate card.
  const tally = `SELECT passes, counted, given, quorate FROM membership_motion.tally('m-2026-011')`
  for (const member of [ines, paul]) {
    assert.deepEqual(await reading(member, tally), [{ passes: null, counted: null, given: null, quorate: null }], `${member} reads no count of Coordination's motion`)
    assert.deepEqual(await reading(member, `SELECT id FROM motion.motion WHERE id = 'm-2026-011'`), [], 'as they read no motion of it')
  }
  const [counted] = await reading(chloe, tally)
  assert.ok(Number(counted.counted) > 0, 'Chloé, a member, reads it by open books')

  // The motion that moves to admit someone: to whom it names, and to the
  // readers of its circle's motions.
  const admitting = `SELECT member, motion FROM employment_membership_motion.admitting()`
  assert.deepEqual(await reading(ines, admitting), [{ member: ines, motion: 'm-2026-012' }], 'Inès, seated in no assembly, reads the motion to admit her, and no one else\'s')
  assert.deepEqual(await reading(paul, admitting), [], 'Paul reads none')

  // Who a distributed split credits: none to whoever reads no distribution.
  for (const member of [ines, paul]) {
    assert.deepEqual(await reading(member, `SELECT member FROM account_membership_patronage_transaction.employable('2025')`), [])
  }
  await app.query(`SELECT set_config('cella.actor', '', false)`)
})

test('a view the app reads reads as its reader: Inès, in Web and no member, and Paul, who left, read nothing through one of a record another circle owns', async () => {
  // An expense's claim: who claimed it and who decided it.
  const claims = async (member: string) => (await reading(member, 'SELECT expense FROM expense_membership.claim ORDER BY expense')).map((r) => r.expense)
  assert.deepEqual(await claims(ines), ['ex-0002', 'ex-0004'], 'Inès reads the claims on Web\'s and the assembly\'s expenses, and not Brand\'s or Marketing\'s')
  assert.deepEqual(await claims(paul), [], 'Paul reads none')
  assert.deepEqual(await claims(chloe), ['ex-0001', 'ex-0002', 'ex-0003', 'ex-0004'], 'Chloé, a member, reads every one by open books')

  // A document's adoption: Coordination's rate card, adopted by its motion.
  const adoption = `SELECT motion, version, hash FROM document_motion.adoption WHERE motion = 'm-2026-011'`
  for (const member of [ines, paul]) {
    assert.deepEqual(await reading(member, adoption), [], `${member} reads neither the version nor the hash Coordination's motion adopts`)
  }
  assert.equal((await reading(chloe, adoption)).length, 1, 'where Chloé reads it')

  // What a motion of Coordination's carries, read through each view over
  // its actions.
  for (const view of ['motion.circle_action', 'membership_motion.action', 'membership_motion.seating', 'motion_patronage.approval']) {
    assert.deepEqual(await reading(ines, `SELECT motion FROM ${view} WHERE motion = 'm-2026-011'`), [], `Inès reads nothing of Coordination's motion through ${view}`)
  }

  // Every other view the app reads as its reader: Paul reads no circle's
  // records through any, only his own path and the reports every scope is
  // drawn with.
  const views = [
    'bill.taxed', 'client_invoice.standing', 'document.adopted', 'document_membership.texts', 'document_motion.adoption',
    'employment_membership_motion.admission', 'expense_membership.claim', 'invoice.standing', 'invoice.taxed',
    'meeting_membership.quorum', 'meeting_membership.roll', 'membership_motion.action', 'membership_motion.mention',
    'membership_motion.seating', 'membership_project.pot', 'motion.circle_action', 'motion_patronage.approval',
    'project.progress', 'project_task.count',
  ]
  for (const view of views) {
    assert.deepEqual(await reading(paul, `SELECT * FROM ${view}`), [], `Paul reads nothing through ${view}`)
  }
  assert.deepEqual((await reading(paul, 'SELECT address FROM employment_membership.path')).map((r) => r.address), [paul], 'Paul reads his own path alone')
  assert.deepEqual(await reading(paul, `SELECT id FROM report.listed WHERE kind = 'custom'`), [], 'and no report a member saved')
  await app.query(`SELECT set_config('cella.actor', '', false)`)
})

test('the log\'s form and the vault are closed to the app; an entry opens to the person it is about, never to a colleague', async () => {
  await assert.rejects(reading(lea, 'SELECT form FROM cella.log LIMIT 1'), /permission denied for table log/)
  await assert.rejects(reading(lea, 'SELECT cella.opened(1)'), /permission denied for function opened/)

  await app.query(`SELECT set_config('cella.actor', '', false)`)
  const given = await profile({ person: lea, email: 'lea@bernard.example', phone: '+33 7 00 00 00 01' }, { db: reader(app, lea), actor: lea, sign: sign(lea) })
  assert.equal(given.state, 'settled')
  const n = given.state === 'settled' ? given.entry : 0
  const [mine] = await reading(lea, 'SELECT cella.disclosed($1) AS o', [n])
  assert.equal(mine.o.values.email, 'lea@bernard.example', 'Léa reads her own email back')
  const [theirs] = await reading(chloe, 'SELECT cella.disclosed($1) AS o', [n])
  assert.equal(theirs.o, null, 'Chloé reads none of it')
})

test('a server logging in as the superuser reads as the app role all the same', async () => {
  const url = `postgres://${encodeURIComponent(su.user ?? 'postgres')}@${su.host}:${su.port}/${su.database}`
  await shell.start('2026-10-24', { DATABASE_URL: url })
  const own = await page('/payslips', chloe)
  assert.equal(own.status, 200)
  assert.ok(own.text.includes(`2026-09~${chloe}`) && !own.text.includes(`~${camille}`), 'Chloé reads her own payslips alone')
  assert.ok(!(await page('/accounts', chloe)).text.includes('101301'))
})
