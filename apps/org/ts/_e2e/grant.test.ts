// The grant scenario, end to end on a seeded Lanterne, through the built
// shell: a mandate is granted, changed and revoked from where it is read,
// each by a motion the circle's page proposes. From coordination's page
// the assembly grants coordination itself send-quote up to 15 000 € a
// write, by motion; from Operations' page, coordination, chosen as its
// issuer, grants the finance role send-quote up to 5 000 €, which the
// motion's page shows it would issue under coordination's, and which its
// close grants under it; a grant of 20 000 € is refused before anything
// is proposed, naming the limit and the mandate it is wider than; a
// change brings the limit down to 4 000 €, put to coordination, which
// issued it; and the assembly revoking coordination's send-quote shows on
// its motion's page that its close revokes finance's under it, which it
// does the same day. Then, in every browser, light and dark, Operations'
// page proposes a grant wider than its parent and shows the refusal, and
// the revocation's page shows what it revoked; `SHOTS` names where its
// screenshots go. Run by `cella test e2e grant`.

import { test as runTest } from 'node:test'
import { createStory } from './story.ts'
export const { before, after, test, unseeded, story } = createStory()
import { mkdirSync } from 'node:fs'
import assert from 'node:assert/strict'
import pg from 'pg'
import { vote } from '@cella/org-motion/api'
import type { Deps } from '@cella/org-db'
import { reader, sign } from './lanterne.ts'
import { browsers, serve, signIn } from './browser.ts'
import { Shell, type Done } from './serve.ts'

const su = new pg.Client()
const shell = new Shell(su)
const shots = process.env.SHOTS ?? '/tmp/cella-grant-shots'
let app: pg.Client | undefined

const camille = 'camille@lanterne.example'
const chloe = 'chloe@lanterne.example'

const as = (actor: string): Deps => ({ db: reader(app as pg.Client, actor), actor, sign: sign(actor) })
const all = async <R>(sql: string, values: unknown[] = []) => (await su.query(sql, values)).rows as R[]
const one = async <R>(sql: string, values: unknown[] = []) => (await all<R>(sql, values))[0]
const settled = (out: Done) => assert.equal(out.state, 'settled', out.reason)

// The shell, and the scenario's own connection, on `date`.
async function on(date: string) {
  await shell.start(date)
  await app?.end()
  app = new pg.Client({ user: 'cella_app' })
  await app.connect()
}

// A motion proposed from a circle's page by Camille, by its title; every
// member on its roll but Chloé, suspended, consents, and Camille closes
// it from its page on its deadline. Returns its id and what its close
// carried.
async function decided(circle: string, fields: Record<string, string>, from: string, deadline: string) {
  await on(from)
  settled(await shell.act(`/circles/${circle}`, 'put', { ...fields, deadline }, camille))
  const { id } = await one<{ id: string }>('SELECT id FROM motion.motion ORDER BY id DESC LIMIT 1')
  for (const { member } of await all<{ member: string }>('SELECT member FROM membership_motion.roll WHERE motion = $1 AND member <> $2', [id, chloe])) {
    assert.equal((await vote({ motion: id, member, stance: 'consent' }, as(member))).state, 'settled')
  }
  return { id, close: async () => {
    await on(deadline)
    const out = await shell.act(`/motions/${id}`, 'close', {}, camille)
    settled(out)
    return out.then
  } }
}

const mandate = (grantee: string, power: string) =>
  one<{ id: string; policy: string; issuer: string; parent: string | null; limit: number | null; revoked: string | null }>(
    `SELECT m.id::text, m.policy, m.issuer, p.grantee AS parent, cella.cents(m."limit")::int AS "limit", to_char(m.revoked, 'YYYY-MM-DD') AS revoked
     FROM circle.mandate m LEFT JOIN circle.mandate p ON p.id = m.parent
     WHERE m.grantee = $1 AND m.power = $2 ORDER BY m.id DESC LIMIT 1`,
    [grantee, power],
  )

let revoking = ''

before(async () => {
  await su.connect()
})

after(async () => {
  await shell.stop()
  await app?.end()
  await su.end()
})

test('from coordination\'s page, the assembly grants coordination itself send-quote up to 15 000 € a write, by motion, a root', async () => {
  const m = await decided(
    'coordination',
    { kind: 'grant', 'arg.grantee': 'circle:coordination', 'arg.power': 'send-quote', 'arg.text': 'grant the working circles\' roles quotes', 'arg.limit': '15000', 'arg.issuer': 'ag' },
    '2026-11-09',
    '2026-11-16',
  )
  assert.equal((await one<{ circle: string }>('SELECT circle FROM motion.motion WHERE id = $1', [m.id])).circle, 'ag')
  assert.deepEqual((await m.close()).map((d) => [d.op, d.state]), [['motion:policy:adopt', 'settled']])
  const granted = await mandate('coordination', 'send-quote')
  assert.deepEqual([granted.issuer, granted.parent, granted.limit], ['ag', null, 1_500_000])
})

test('from Operations\' page, coordination grants finance send-quote up to 5 000 €: its page says it would be issued under coordination\'s, and its close grants it so', async () => {
  const parent = await mandate('coordination', 'send-quote')
  const m = await decided(
    'operations',
    { kind: 'grant', 'arg.grantee': 'role:finance', 'arg.power': 'send-quote', 'arg.text': 'send a quote', 'arg.limit': '5000', 'arg.issuer': 'coordination' },
    '2026-11-16',
    '2026-11-23',
  )
  assert.equal((await one<{ circle: string }>('SELECT circle FROM motion.motion WHERE id = $1', [m.id])).circle, 'coordination')
  assert.deepEqual(await all('SELECT n, kind, closed, granted, parent::text, flaw FROM motion.issues($1)', [m.id]), [
    { n: 1, kind: 'policy', closed: false, granted: null, parent: parent.id, flaw: null },
  ])
  assert.deepEqual((await m.close()).map((d) => [d.op, d.state]), [['motion:policy:adopt', 'settled']])
  const granted = await mandate('finance', 'send-quote')
  assert.deepEqual([granted.issuer, granted.parent, granted.limit], ['coordination', 'coordination', 500_000])
  assert.deepEqual(await all('SELECT closed, granted::text, parent::text FROM motion.issues($1)', [m.id]), [{ closed: true, granted: granted.id, parent: parent.id }])
})

test('a grant of 20 000 €, wider than coordination\'s, is refused before anything is proposed, naming the limit and the mandate it is wider than', async () => {
  const before = await one<{ n: number }>('SELECT count(*)::int AS n FROM motion.motion')
  const parent = await mandate('coordination', 'send-quote')
  const out = await shell.act(
    '/circles/operations',
    'put',
    { kind: 'grant', 'arg.grantee': 'role:finance', 'arg.power': 'send-quote', 'arg.limit': '20000', 'arg.issuer': 'coordination', deadline: '2026-11-30' },
    camille,
  )
  assert.equal(out.state, 'failed')
  assert.equal(
    out.reason,
    `Limit per write: it is wider than mandate ${parent.id}, the send-quote coordination holds to issue it under: its cap, up to 20000.00 € a write, is wider than its parent's, up to 15000.00 € a write; narrow it to fit, or put it to ag`,
  )
  assert.deepEqual(await one('SELECT count(*)::int AS n FROM motion.motion'), before, 'nothing is proposed')
})

test('from Operations\' page, a change brings finance\'s limit down to 4 000 €, put to coordination, which issued it, and replaces its mandate under the same parent', async () => {
  const old = await mandate('finance', 'send-quote')
  const m = await decided(
    'operations',
    { kind: 'change', 'arg.policy': old.policy, 'arg.grantee': 'role:finance', 'arg.power': 'send-quote', 'arg.text': 'send a quote', 'arg.limit': '4000' },
    '2026-11-23',
    '2026-11-30',
  )
  assert.equal((await one<{ circle: string }>('SELECT circle FROM motion.motion WHERE id = $1', [m.id])).circle, 'coordination')
  assert.deepEqual(await all('SELECT kind, ends::text, revokes::text[] FROM motion.issues($1)', [m.id]), [{ kind: 'policy', ends: old.id, revokes: [old.id] }])
  assert.deepEqual((await m.close()).map((d) => [d.op, d.state]), [['motion:policy:adopt', 'settled']])
  const changed = await mandate('finance', 'send-quote')
  assert.deepEqual([changed.issuer, changed.parent, changed.limit, changed.revoked], ['coordination', 'coordination', 400_000, null])
  assert.equal((await one<{ revoked: string }>(`SELECT to_char(revoked, 'YYYY-MM-DD') AS revoked FROM circle.mandate WHERE id = $1`, [old.id])).revoked, '2026-11-30')
})

test('from coordination\'s page, the assembly revoking coordination\'s send-quote shows on its page that its close revokes finance\'s under it, and it does, the same day', async () => {
  const up = await mandate('coordination', 'send-quote')
  const down = await mandate('finance', 'send-quote')
  const m = await decided('coordination', { kind: 'revoke', 'arg.policy': up.policy }, '2026-11-30', '2026-12-07')
  revoking = m.id
  assert.equal((await one<{ circle: string }>('SELECT circle FROM motion.motion WHERE id = $1', [m.id])).circle, 'ag')
  assert.deepEqual(await all('SELECT kind, ends::text, revokes::text[] FROM motion.issues($1)', [m.id]), [{ kind: 'end', ends: up.id, revokes: [up.id, down.id] }])
  assert.deepEqual((await m.close()).map((d) => [d.op, d.state]), [['motion:policy:end', 'settled']])
  assert.deepEqual(
    [(await mandate('coordination', 'send-quote')).revoked, (await mandate('finance', 'send-quote')).revoked],
    ['2026-12-07', '2026-12-07'],
  )
  assert.deepEqual(await all('SELECT closed, revokes::text[] FROM motion.issues($1)', [m.id]), [{ closed: true, revokes: [up.id, down.id] }])
})

unseeded('in every browser, light and dark, Operations\' page refuses a grant wider than its parent before proposing it, and the revocation\'s page shows what it revoked', async () => {
  // The assembly grants coordination send-quote again, so a grant under it
  // has a parent to be wider than.
  const again = await decided(
    'coordination',
    { kind: 'grant', 'arg.grantee': 'circle:coordination', 'arg.power': 'send-quote', 'arg.text': 'grant the working circles\' roles quotes', 'arg.limit': '15000', 'arg.issuer': 'ag' },
    '2026-12-07',
    '2026-12-14',
  )
  await again.close()
  const parent = await mandate('coordination', 'send-quote')
  const motions = await one<{ n: number }>('SELECT count(*)::int AS n FROM motion.motion')
  await shell.stop()
  mkdirSync(shots, { recursive: true })
  for (const [engine, launch] of browsers()) {
    const browser = await launch()
    const dev = await serve()
    try {
      for (const scheme of ['light', 'dark'] as const) {
        const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, colorScheme: scheme, extraHTTPHeaders: { 'x-forwarded-proto': 'http' } })
        await signIn(context, dev.base, camille)
        const page = await context.newPage()
        const errors: string[] = []
        page.on('pageerror', (e) => errors.push(e.message))
        await page.goto(`${dev.base}/circles/operations`)
        await page.waitForLoadState('networkidle')
        await page.getByRole('button', { name: 'Propose…' }).click()
        const form = page.locator('form', { has: page.locator('select[name="kind"] option[value="change"]') })
        await form.getByLabel('Proposes to').selectOption('grant')
        await form.getByLabel('Grantee').selectOption('role:finance')
        await form.getByLabel('Power', { exact: true }).fill('send-quote')
        await form.getByLabel('Grants', { exact: true }).fill('send a quote')
        await form.getByLabel('Limit per write, €').fill('20000')
        await form.getByLabel('Issued by').selectOption('coordination')
        await form.getByLabel('Deadline', { exact: true }).fill('2026-12-21')
        const sentence = 'It will read: The finance role holds send-quote, to send a quote, up to 20 000 € a write.'
        assert.equal(await form.getByText(/^It will read:/).textContent(), sentence, `${engine}, ${scheme}: the sentence as it will read`)
        await form.getByRole('button', { name: 'Propose' }).click()
        const refusal = page.getByText(/Limit per write: it is wider than mandate/).first()
        await refusal.waitFor()
        assert.match((await refusal.textContent()) ?? '', new RegExp(`mandate ${parent.id}, the send-quote coordination holds to issue it under: its cap, up to 20000\\.00 € a write, is wider than its parent's, up to 15000\\.00 € a write`))
        await page.screenshot({ path: `${shots}/refused-${engine}-${scheme}.png`, fullPage: true })

        await page.goto(`${dev.base}/motions/${revoking}`)
        await page.waitForLoadState('networkidle')
        const section = page.locator('section', { has: page.getByRole('heading', { name: 'Mandates' }) })
        assert.match((await section.textContent()) ?? '', /Action 1 revoked 2 mandates the same day, the one it ends and every one issued under it\./)
        assert.match((await section.textContent()) ?? '', /Revoked with it/)
        await section.scrollIntoViewIfNeeded()
        await page.screenshot({ path: `${shots}/revoked-${engine}-${scheme}.png`, fullPage: true })
        assert.deepEqual(errors, [], 'the page threw nothing')
        await context.close()
      }
    } finally {
      await browser.close()
      await dev.stop()
    }
  }
  assert.deepEqual(await one('SELECT count(*)::int AS n FROM motion.motion'), motions, 'no browser proposed the refused grant')
})

test('the log verifies', async () => {
  assert.equal((await one<{ v: boolean }>('SELECT cella.verify_log() AS v')).v, true)
})

if (!process.env.CELLA_STORY) runTest('grant story', async (t) => story((name, step) => t.test(name, step)))
