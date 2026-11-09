// A refusal for want of a power, end to end on a seeded Lanterne: one
// write per cause, posted from the page that makes it as a browser posts
// it, and the reason the page shows names the mandate missing or exceeded
// and what would fix it, with the values it read, and never a person:
// none, a limit exceeded, a scope not covering, a suspended member's, and
// last a mandate revoked, by a motion proposed from a circle's page and
// closed from its own. Run by `cella test`, which builds the shell first,
// on a fresh database.

import { test as runTest } from 'node:test'
import { createStory } from './story.ts'
export const { before, after, test, unseeded, story } = createStory()
import assert from 'node:assert/strict'
import pg from 'pg'
import { vote } from '@cella/org-motion/api'
import type { Deps } from '@cella/org-db'
import { reader, sign } from './lanterne.ts'
import { Shell, type Done } from './serve.ts'

const su = new pg.Client()
const shell = new Shell(su)
let app: pg.Client | undefined

const camille = 'camille@lanterne.example'
const chloe = 'chloe@lanterne.example'
const yusuf = 'yusuf@lanterne.example'
const thomas = 'thomas@lanterne.example'

const as = (actor: string): Deps => ({ db: reader(app as pg.Client, actor), actor, sign: sign(actor) })
const all = async <R>(sql: string, values: unknown[] = []) => (await su.query(sql, values)).rows as R[]
const one = async <R>(sql: string, values: unknown[] = []) => (await all<R>(sql, values))[0]
const mandate = async (grantee: string, power: string) =>
  (await one<{ id: string }>('SELECT id FROM circle.mandate WHERE grantee = $1 AND power = $2 AND revoked IS NULL ORDER BY id LIMIT 1', [grantee, power])).id

// The shell, and the scenario's own connection, on `date`.
async function on(date: string) {
  await shell.start(date)
  await app?.end()
  app = new pg.Client({ user: 'cella_app' })
  await app.connect()
}

// The reason a refused write's page shows, and that it names no one.
function refused(done: Done): string {
  assert.equal(done.state, 'refused', JSON.stringify(done))
  const reason = done.reason ?? ''
  assert.ok(!reason.includes('@lanterne'), `a reason names no person: ${reason}`)
  return reason
}

before(async () => {
  await su.connect()
  await on('2026-10-24')
})

after(async () => {
  await shell.stop()
  await app?.end()
  await su.end()
})

test('none: Camille issues an invoice, and the page names the role that holds issue-invoice and its mandate', async () => {
  const reason = refused(await shell.act('/invoices', 'issue', {
    series: 'F-2026',
    bill_to: 'Vélo Solidaire',
    bill_address: '42 rue de Romainville\n93100 Montreuil',
    label: 'Workshop on accessibility',
    description: ['Workshop'],
    quantity: ['1'],
    unit_price: ['450'],
    vat_rate: ['20'],
  }, camille))
  assert.equal(reason, `the actor holds no mandate for issue-invoice over ag's records: it is held by finance in operations (mandate ${await mandate('finance', 'issue-invoice')}, issued by ag), and a tenure of one would allow it`)
})

test('exceeded: Yusuf budgets a project past his limit, and the page names his mandate, its limit and who may raise it', async () => {
  const reason = refused(await shell.act('/projects/halles-shop', 'budget', { amount: '60000' }, yusuf))
  assert.match(reason, new RegExp(`^the actor holds no mandate for set-budget up to 60000\\.00 €: mandate ${await mandate('lead', 'set-budget')} grants it to lead in web up to [0-9.]+ € a write, issued by [a-z-]+; a motion of [a-z-]+ raising its limit to 60000\\.00 €`))
})

test('scope: Yusuf budgets Brand\'s project, and the page names what his mandate covers and what would cover it', async () => {
  const reason = refused(await shell.act('/projects/velo-identity', 'budget', { amount: '3400' }, yusuf))
  assert.match(reason, new RegExp(`^the actor holds set-budget by no mandate covering brand's records: mandate ${await mandate('lead', 'set-budget')} grants it to lead in web over web's records, issued by [a-z-]+; a tenure of a role holding it there, .*lead in brand .*would allow it$`))
})

test('suspended: Thomas, suspended, marks a client, and the page says his mandate grants to an active member alone', async () => {
  // The host stages the suspension around the notary, as only a superuser
  // may, and lifts it again, so the log folds as it stood.
  await su.query('SET cella.unbound = on')
  await su.query(`UPDATE membership.member SET status = 'suspended', suspended = '2026-10-20' WHERE address = $1`, [thomas])
  try {
    const reason = refused(await shell.act('/contacts/halles-roux', 'client', { client: 'lead' }, thomas))
    assert.match(reason, /^the actor holds no mandate for [a-z-]+, their membership being suspended: mandate \d+ grants it to [a-z-]+ in [a-z-]+ for an active member alone, and an active membership would allow it$/)
  } finally {
    await su.query(`UPDATE membership.member SET status = 'active', suspended = NULL WHERE address = $1`, [thomas])
    await su.query('SET cella.unbound = off')
  }
})

// Last, since a revocation stays: the assembly revokes the leads'
// set-budget by a motion proposed from Web's page, every member on its
// roll but Chloé, suspended, consenting, and closed from its page on its
// deadline; then Yusuf's own project's budget names the mandate and the day.
test('revoked: once the leads\' set-budget is revoked by motion, Yusuf\'s own project\'s budget names the mandate and the day', async () => {
  const id = await mandate('lead', 'set-budget')
  const { policy } = await one<{ policy: string }>('SELECT policy FROM circle.mandate WHERE id = $1', [id])
  await on('2026-11-09')
  const put = await shell.act('/circles/web', 'put', { kind: 'revoke', 'arg.policy': policy, deadline: '2026-11-16' }, camille)
  assert.equal(put.state, 'settled', put.reason)
  const { motion } = await one<{ motion: string }>('SELECT id AS motion FROM motion.motion ORDER BY id DESC LIMIT 1')
  for (const { member } of await all<{ member: string }>('SELECT member FROM membership_motion.roll WHERE motion = $1 AND member <> $2', [motion, chloe])) {
    assert.equal((await vote({ motion, member, stance: 'consent' }, as(member))).state, 'settled')
  }
  await on('2026-11-16')
  const closed = await shell.act(`/motions/${motion}`, 'close', {}, camille)
  assert.equal(closed.state, 'settled', closed.reason)
  const reason = refused(await shell.act('/projects/clairval-site', 'budget', { amount: '14000' }, yusuf))
  assert.match(reason, new RegExp(`^the actor holds no mandate for set-budget up to 14000\\.00 €: mandate ${id} grants it to lead in web, revoked on 2026-11-16; a motion of [a-z-]+ granting it anew would allow it$`))
})

if (!process.env.CELLA_STORY) runTest('refusal story', async (t) => story((name, step) => t.test(name, step)))
