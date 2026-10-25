// The reading scenario, end to end on a seeded Lanterne, through the built
// shell outside dev mode, each page read as a signed-in member: Chloé, a
// designer holding no power over pay or the books, reads her own pay and
// capital and no colleague's; Julien, in finance, reads everyone's; and a
// member's personal values in the log open to them, never to a colleague.
// Run by `cella test e2e reading`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { profile } from '@cella/org-person/api'
import { Shell } from './serve.ts'
import { sign } from './lanterne.ts'

const su = new pg.Client()
const shell = new Shell(su)
let app: pg.Client

const camille = 'camille@lanterne.example'
const chloe = 'chloe@lanterne.example'
const julien = 'julien@lanterne.example'
const lea = 'lea@lanterne.example'

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

test('a worker reads their own capital account and its lines, and no colleague\'s; finance reads every one', async () => {
  // Camille's capital account is 101301 and Chloé's 101310.
  const accounts = await page('/accounts', chloe)
  assert.ok(accounts.text.includes('101310'), 'Chloé reads her capital account')
  assert.ok(!accounts.text.includes('101301'), 'and not Camille\'s')
  assert.ok(accounts.text.includes('Banque'), 'the co-op\'s own accounts are every member\'s')
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

test('the statements are every member\'s, whole, whoever reads them', async () => {
  const sql = `SELECT id, amount FROM account_transaction.statement('balance', NULL, '2026-09-30') ORDER BY n`
  assert.deepEqual(await reading(chloe, sql), await reading(julien, sql))
  const equity = (await reading(chloe, sql)).find((r) => r.id === 'capital')
  assert.ok(equity && Number(equity.amount) > 0, 'the capital rubric sums every member\'s capital for Chloé too')
})

test('the log\'s form and the vault are closed to the app; an entry opens to the person it is about, never to a colleague', async () => {
  await assert.rejects(reading(lea, 'SELECT form FROM cella.log LIMIT 1'), /permission denied for table log/)
  await assert.rejects(reading(lea, 'SELECT cella.opened(1)'), /permission denied for function opened/)

  await app.query(`SELECT set_config('cella.actor', '', false)`)
  const given = await profile({ person: lea, email: 'lea@bernard.example', phone: '+33 7 00 00 00 01' }, { db: app, actor: lea, sign: sign(lea) })
  assert.equal(given.state, 'settled')
  const n = given.state === 'settled' ? given.entry : 0
  const [mine] = await reading(lea, 'SELECT cella.disclosed($1) AS o', [n])
  assert.equal(mine.o.values.email, 'lea@bernard.example', 'Léa reads her own email back')
  const [theirs] = await reading(chloe, 'SELECT cella.disclosed($1) AS o', [n])
  assert.equal(theirs.o, null, 'Chloé reads none of it')
})
