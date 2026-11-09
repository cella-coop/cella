// A custom report reads for its reader, end to end on a seeded Lanterne,
// through the built shell outside dev mode and its analytics shell: Chloé,
// a member, in Marketing, reads every circle's expenses by the member
// role's mandate to read every circle, and saves a custom report over
// `expense.expenses`; the assembly ends that mandate; run as her, the same
// report and a new one she saves show no expense of a circle she no longer
// reads, and her own still, one spent for Brand among them; Inès, in Web
// and no member, who never held the mandate, reads through both Web's and
// the assembly's alone, as before. Each report reads what the expenses'
// page shows its reader, and no more. Run by `cella test e2e
// report-reader`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { scoped } from '@cella/org-analytics'
import { capture } from '@cella/org-expense/api'
import { vote } from '@cella/org-motion/api'
import { carried, close, propose } from '@cella/org-graft-membership-motion/api'
import { custom } from '@cella/org-report/api'
import type { Deps } from '@cella/org-db'
import { reading as opened, type Reading } from './port.ts'
import { Shell } from './serve.ts'
import { reader, sign } from './lanterne.ts'

const su = new pg.Client()
const shell = new Shell(su)
let app: pg.Client
let analytics: Reading

const at = (name: string) => `${name}@lanterne.example`
const camille = at('camille')
const chloe = at('chloe')
const ines = at('ines')
const assembly = ['camille', 'yusuf', 'hugo', 'malik', 'julien', 'amina', 'thomas', 'lea', 'chloe', 'sofia'].map(at)

// Lanterne's expenses: Brand's, Sofia's; Web's, Thomas's; Marketing's,
// Chloé's; the assembly's, Léa's; Coordination's; Operations'; Marketing's
// refused one, Chloé's; and the one Chloé spends for Brand.
const theirs = ['ex-0001', 'ex-0002', 'ex-0003', 'ex-0004', 'ex-0005', 'ex-0006', 'ex-0007']
let hers = ''

const definition = { from: { e: 'expense.expenses' }, fields: ['e.id', 'e.circle', 'e.member'], order: ['e.id'] }
const later = { from: { e: 'expense.expenses' }, fields: ['e.id', 'e.net'], order: ['e.id'] }

const as = (actor: string): Deps => ({ db: reader(app, actor), actor, sign: sign(actor) })
const settled = <T>(out: { state: string; value?: T; reason?: string }): T => {
  assert.equal(out.state, 'settled', out.state === 'refused' ? out.reason : '')
  return out.value as T
}

// The app role's day, as the built server's connections and the scenario's
// own read it.
async function on(date: string) {
  await su.query(`ALTER ROLE cella_app IN DATABASE ${su.escapeIdentifier(su.database ?? '')} SET cella.clock = '${date}'`)
  await app?.end()
  app = new pg.Client({ user: 'cella_app' })
  await app.connect()
}

// The expenses a page shows its reader, of those named.
const shown = (text: string, ids: string[]) => ids.filter((id) => text.includes(id))

// What `actor` reads of every expense through a saved report's page, and
// through the port the server hands that page, run as them.
async function through(id: string, saved: Parameters<typeof custom>[1], actor: string) {
  const page = await shell.page(`/reports/${id}?tab=figures`, actor)
  assert.equal(page.status, 200, `${actor} opens ${id}`)
  const rows = (await custom(scoped(analytics.analytics, reader(app, actor)), saved)).custom.result.rows
  return { page: shown(page.text, [...theirs, hers]), port: rows.map((r) => String(r['e.id'])) }
}

// What the expenses' page shows `actor`.
async function listed(actor: string) {
  const page = await shell.page('/expenses', actor)
  assert.equal(page.status, 200)
  return shown(page.text, [...theirs, hers])
}

before(async () => {
  await su.connect()
  await on('2026-10-24')
  analytics = await opened(su, 50, '2026-10-24')
  await shell.start('2026-10-24', analytics.env)
})

after(async () => {
  await app.end()
  await shell.stop()
  analytics?.stop()
  await su.end()
})

test('Chloé, reading every circle by the member role\'s mandate, spends for Brand and saves a report over every expense, which shows her each one', async () => {
  const spent = settled(
    await capture({ member: chloe, day: '2026-10-20', label: 'Brand workshop: printed boards', category: '606', net: 4000, vat: 800, receipt: null, circle: 'brand' }, as(chloe)),
  )
  hers = spent.expense
  assert.equal(spent.circle, 'brand')

  const done = await shell.act('/reports', 'save', { title: 'Expenses by id', caption: '', definition: JSON.stringify(definition) }, chloe)
  assert.equal(done.state, 'settled', done.reason)
  const before = await through('expenses-by-id', definition, chloe)
  assert.deepEqual(before.page, [...theirs, hers], 'Chloé reads every circle\'s expenses through her report')
  assert.deepEqual(before.port, [...theirs, hers].sort())
  assert.deepEqual(await listed(chloe), [...theirs, hers], 'as the expenses\' page shows her')
})

test('the assembly ends the member role\'s mandate to read every circle', async () => {
  const [{ policy }] = (await su.query<{ policy: string }>(`SELECT policy FROM circle.mandate WHERE grantee = 'member' AND power = 'read' AND revoked IS NULL`)).rows
  const action = { kind: 'end', args: { policy } }
  const { motion } = settled(await propose({ circle: 'ag', title: 'The books close to all but each circle', procedure: 'consent', deadline: '2026-11-07', body: '', actions: [action] }, as(camille)))
  for (const member of assembly) {
    settled(await vote({ motion, member, stance: 'consent' }, as(member)))
  }
  await on('2026-11-07')
  settled(await close({ motion }, as(camille)))
  const out = await carried(motion, as(camille))
  assert.deepEqual(out.map((d) => [d.op, d.state, d.reason ?? '']), [['motion:policy:end', 'settled', '']])
  const [{ revoked }] = (await su.query<{ revoked: string }>(`SELECT to_char(revoked, 'YYYY-MM-DD') AS revoked FROM circle.mandate WHERE policy = $1`, [policy])).rows
  assert.equal(revoked, '2026-11-07')
  await shell.start('2026-11-07', analytics.env)
})

test('once it ends, Chloé reads through the same report no expense of a circle she no longer reads, and her own still', async () => {
  const after = await through('expenses-by-id', definition, chloe)
  assert.deepEqual(after.page, ['ex-0003', 'ex-0004', 'ex-0007', hers], 'Marketing\'s, hers, the assembly\'s, and the one she spent for Brand, hers')
  assert.deepEqual(after.port, ['ex-0003', 'ex-0004', 'ex-0007', hers].sort(), 'and the port the page reads through, run as her, reads the same')
  assert.deepEqual(await listed(chloe), after.page, 'as the expenses\' page shows her')
})

test('a new report Chloé saves once it ends reads the same', async () => {
  const done = await shell.act('/reports', 'save', { title: 'Expenses net', caption: '', definition: JSON.stringify(later) }, chloe)
  assert.equal(done.state, 'settled', done.reason)
  const read = await through('expenses-net', later, chloe)
  assert.deepEqual(read.page, ['ex-0003', 'ex-0004', 'ex-0007', hers], 'no Brand expense but hers, no Web one')
  assert.deepEqual(read.port, ['ex-0003', 'ex-0004', 'ex-0007', hers].sort())
})

test('Inès, who never held the mandate, reads through both reports Web\'s and the assembly\'s alone', async () => {
  for (const [id, saved] of [['expenses-by-id', definition], ['expenses-net', later]] as const) {
    const read = await through(id, saved, ines)
    assert.deepEqual(read.page, ['ex-0002', 'ex-0004'], `Inès reads Web's and the assembly's through ${id}, and no other circle's nor Chloé's`)
    assert.deepEqual(read.port, ['ex-0002', 'ex-0004'])
  }
  assert.deepEqual(await listed(ines), ['ex-0002', 'ex-0004'], 'as the expenses\' page shows her')
})
