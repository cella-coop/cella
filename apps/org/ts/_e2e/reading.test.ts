// The reading scenario, end to end on a seeded Lanterne, through the built
// shell outside dev mode, each page read as a signed-in member: reading
// follows the mandates, so Chloé, in Marketing, reads Marketing's
// expenses and not Web's, and Web's lead Web's time alone; Chloé, a
// designer holding no power over pay or the books, reads her own pay and
// capital and no colleague's; Julien, in finance, reads everyone's; what
// sums the whole, the statements, an entry's amount and a share the 2025
// surplus would give, is the same whoever reads it; a member's personal
// values in the log open to them, never to a colleague; and a server
// logging in as the superuser reads as the app role all the same. Run by
// `cella test e2e reading`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { profile } from '@cella/org-person/api'
import { Shell } from './serve.ts'
import { reader, sign } from './lanterne.ts'

const su = new pg.Client()
const shell = new Shell(su)
let app: pg.Client

const camille = 'camille@lanterne.example'
const chloe = 'chloe@lanterne.example'
const julien = 'julien@lanterne.example'
const lea = 'lea@lanterne.example'
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
  await shell.start('2026-10-24')
  app = new pg.Client({ user: 'cella_app' })
  await app.connect()
})

after(async () => {
  await app.end()
  await shell.stop()
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

test('reading follows the mandates: Chloé reads Marketing\'s expenses and her own pay, and not Web\'s expenses or Yusuf\'s pay', async () => {
  const expenses = await page('/expenses', chloe)
  assert.equal(expenses.status, 200)
  assert.ok(expenses.text.includes('ex-0003'), 'Chloé, in Marketing, reads Marketing\'s expense by read on her own circle')
  assert.ok(expenses.text.includes('ex-0004'), 'and the assembly\'s, the whole co-op\'s, seated there as a member')
  assert.ok(!expenses.text.includes('ex-0002'), 'and not Web\'s')
  assert.equal((await page('/expenses/ex-0002', chloe)).status, 404, 'Web\'s expense is none to her')
  assert.equal((await page('/expenses/ex-0002', camille)).status, 200, 'the gérante, approving every circle\'s expenses, reads it')
  assert.deepEqual(await reading(chloe, `SELECT id FROM expense.expense WHERE circle = 'web'`), [], 'and a direct query as the app role reads none of Web\'s')

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

  // The 2025 surplus, not yet approved: what its work share would give
  // each worker by pay.
  const shares = `SELECT member, amount FROM patronage_payslip.work_share WHERE distribution = '2025' ORDER BY member`
  const everyone = await reading(julien, shares)
  assert.equal(everyone.length, 10, 'Julien, who distributes the surplus, reads every worker\'s share')
  assert.deepEqual(await reading(chloe, shares), everyone.filter((s) => s.member === chloe), 'Chloé reads her own, the same as Julien reads it')
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
