// The authority walk, end to end on a seeded Lanterne, as Lanterne's
// page says the operator walks it (fixtures/lanterne, The authority
// walk). Its story, through the handlers, reads the print buyer's
// approve-bill chain from the assembly's root, three deep; refuses
// Sofia, the print buyer, a bill recorded by no mandate, the paper bill
// over her limit and the assembly's rent outside her scope, each naming
// the mandate and the fix; and from Brand's page puts a grant of
// record-bill to her role to the assembly and a change raising her
// approve-bill to 1 500 € to Operations, which issued it, every vote
// in, then moves the clock to their deadline, so `cella seed lanterne
// --scenario authority-walk` leaves four motions for the operator to
// close. Its unseeded steps, which the test alone runs, walk it in
// every browser, light and dark, as the person each step names: the chain, Sofia's powers, her refusals,
// Brand's Propose…, the print buyer's mandate's Change… and Revoke…
// and what each open motion would issue or revoke;
// closes the grant, the change, m-2026-013 and m-2026-014 in that order,
// m-2026-014's revoking every mandate under coordination's the same day,
// each closed motion naming only what its own close revoked;
// and walks again, the revocation's page and the refusal it leaves.
// `SHOTS` names where its screenshots go. Run by `cella test e2e
// authority-walk`.

import { test as runTest } from 'node:test'
import { createStory } from './story.ts'
export const { before, after, test, unseeded, story } = createStory()
import { mkdirSync } from 'node:fs'
import assert from 'node:assert/strict'
import pg from 'pg'
import type { BrowserContext, Page } from 'playwright-core'
import { circles, vote } from '@cella/org-motion/api'
import type { circles as circleMotions } from '@cella/org-motion/models'
import { carried, close, propose } from '@cella/org-graft-membership-motion/api'
import { record } from '@cella/org-bill/api'
import { approve } from '@cella/org-graft-bill-transaction/api'
import type { Deps } from '@cella/org-db'
import { reader, sign } from './lanterne.ts'
import { browsers, serve, signIn } from './browser.ts'

const su = new pg.Client()
let app: pg.Client | undefined

const camille = 'camille@lanterne.example'
const sofia = 'sofia@lanterne.example'
const julien = 'julien@lanterne.example'
const shots = process.env.SHOTS ?? '/tmp/cella-authority-walk-shots'
const paper = 'bi-0001'
const rent = 'bi-0002'

async function on(date: string) {
  await su.query(`ALTER ROLE cella_app IN DATABASE ${su.escapeIdentifier(su.database ?? '')} SET cella.clock = '${date}'`)
  await app?.end()
  app = new pg.Client({ user: 'cella_app' })
  await app.connect()
}

const as = (actor: string): Deps => ({ db: reader(app as pg.Client, actor), actor, sign: sign(actor) })
const all = async <R>(sql: string, values: unknown[] = []) => (await su.query(sql, values)).rows as R[]
const one = async <R>(sql: string, values: unknown[] = []) => (await all<R>(sql, values))[0]
const reason = (out: { state: string; reason?: string }) => (out.state === 'refused' ? (out.reason ?? '') : '')
const settled = <T>(out: { state: string; value?: T; reason?: string }): T => {
  assert.equal(out.state, 'settled', reason(out))
  return out.value as T
}

// The mandate a grantee holds for a power, the latest granted.
const mandate = (grantee: string, power: string) =>
  one<{ id: string; policy: string; limit: number | null; revoked: string | null }>(
    `SELECT id::text, policy, cella.cents("limit")::int AS "limit", to_char(revoked, 'YYYY-MM-DD') AS revoked
     FROM circle.mandate WHERE grantee = $1 AND power = $2 ORDER BY id DESC LIMIT 1`,
    [grantee, power],
  )

// A motion put from a circle's page by a member seated where it is put,
// as the shell puts it, every member on its roll consenting; its id.
async function put(m: circleMotions.Put, by: string) {
  const { motion } = settled(await propose(await circles.putting(m, as(by).db), as(by))) as { motion: string }
  for (const { member } of await all<{ member: string }>('SELECT member FROM membership_motion.roll WHERE motion = $1', [motion])) {
    settled(await vote({ motion, member, stance: 'consent' }, as(member)))
  }
  return motion
}

// The two motions the story puts from Brand's page.
const granting: circleMotions.Put = {
  circle: 'brand',
  kind: 'grant',
  args: { role: 'print-buyer', power: 'record-bill', text: 'record the print and paper bills of Brand', scope: 'brand' },
  deadline: '2026-10-31',
  body: 'Sofia gets the print bills first; let her record them.',
}
const changing = (policy: string): circleMotions.Put => ({
  circle: 'brand',
  kind: 'change',
  args: { policy, role: 'print-buyer', power: 'approve-bill', text: 'approve the print and paper bills of Brand', limit: 1500, scope: 'brand' },
  deadline: '2026-10-31',
  body: 'Paper went up; most print runs now come to between 1 200 € and 1 500 €.',
})
// The ids of the two, open on 31 October, by the action each carries.
const opened = async () => {
  const by = async (wording: string) =>
    (await one<{ motion: string }>(`SELECT motion FROM motion.action WHERE args ->> 'wording' LIKE $1 AND motion NOT LIKE 'm-2021-%' ORDER BY motion DESC LIMIT 1`, [wording])).motion
  return { grant: await by('%{power: record-bill}%print and paper bills of Brand%'), change: await by('%{power: approve-bill}%print and paper bills of Brand%') }
}

before(async () => {
  await su.connect()
  await on('2026-10-24')
})

after(async () => {
  await app?.end()
  await su.end()
})

test('the print buyer\'s approve-bill reads its chain from the assembly\'s root, three deep, each narrower than the one above', async () => {
  const deepest = await mandate('print-buyer', 'approve-bill')
  assert.deepEqual(
    await all(`SELECT c.grantee, c.issuer, cella.cents(m."limit")::int AS "limit", m.scope, c.depth FROM circle.chain($1) c JOIN circle.mandate m ON m.id = c.id ORDER BY c.depth`, [deepest.id]),
    [
      { grantee: 'coordination', issuer: 'ag', limit: 300000, scope: null, depth: 0 },
      { grantee: 'operations', issuer: 'coordination', limit: 200000, scope: null, depth: 1 },
      { grantee: 'print-buyer', issuer: 'operations', limit: 120000, scope: 'brand', depth: 2 },
    ],
  )
})

test('Sofia is refused a bill recorded, the paper bill over her limit and the rent outside her scope, each naming the mandate and what would fix it', async () => {
  const hers = (await mandate('print-buyer', 'approve-bill')).id
  const none = reason(await record(
    { supplier: 'Imprimerie du Parc', reference: 'FA-2026-1203', issued: '2026-10-23', label: 'Proofs', category: '606', circle: 'brand', lines: [{ description: 'Proofs', quantity: '1', unit_price: 120_00, vat_rate: 2000 }] },
    as(sofia),
  ))
  assert.match(none, new RegExp(`^the actor holds no mandate for record-bill over brand's records: it is held by finance in operations \\(mandate ${(await mandate('finance', 'record-bill')).id}, issued by ag\\)`))
  const over = reason(await approve({ bill: paper }, as(sofia)))
  assert.match(over, new RegExp(`^the actor holds no mandate for approve-bill up to 1440\\.00 €: mandate ${hers} grants it to print-buyer in brand up to 1200\\.00 € a write, issued by operations; a motion of operations raising its limit to 1440\\.00 €`))
  const outside = reason(await approve({ bill: rent }, as(sofia)))
  assert.match(outside, new RegExp(`^the actor holds approve-bill by no mandate covering ag's records: mandate ${hers} grants it to print-buyer in brand over brand's records, issued by operations`))
  for (const r of [none, over, outside]) {
    assert.ok(!r.includes('@lanterne'), `a reason names no person: ${r}`)
  }
})

test('from Brand\'s page, a grant of record-bill to the print buyer over Brand\'s bills is put to the assembly, since no circle holds a mandate to issue it under', async () => {
  assert.equal((await circles.putting(granting, as(camille).db)).circle, 'ag')
  const motion = await put(granting, camille)
  assert.deepEqual(await all('SELECT kind, closed, parent::text, flaw FROM motion.issues($1)', [motion]), [{ kind: 'policy', closed: false, parent: null, flaw: null }])
})

test('from Brand\'s page, a change raising the print buyer\'s approve-bill to 1 500 € is put to Operations, which issued it, and would end the one it replaces', async () => {
  const old = await mandate('print-buyer', 'approve-bill')
  assert.equal((await circles.putting(changing(old.policy), as(camille).db)).circle, 'operations')
  const motion = await put(changing(old.policy), julien)
  assert.deepEqual(await all('SELECT kind, parent::text, ends::text, revokes::text[] FROM motion.issues($1)', [motion]), [
    { kind: 'policy', parent: (await mandate('operations', 'approve-bill')).id, ends: old.id, revokes: [old.id] },
  ])
})

test('on 31 October, the four motions wait to be closed, and m-2026-014 would revoke coordination\'s and every mandate under it', async () => {
  await on('2026-10-31')
  const { grant, change } = await opened()
  const open = ['m-2026-013', 'm-2026-014', grant, change]
  assert.deepEqual((await all<{ id: string }>('SELECT id FROM motion.motion WHERE closed IS NULL AND id = ANY($1) ORDER BY id', [open])).map((m) => m.id), [...open].sort())
  const under = await all<{ id: string }>(`SELECT id::text FROM circle.mandate WHERE power = 'approve-bill' AND grantee IN ('coordination', 'operations', 'print-buyer') AND revoked IS NULL ORDER BY id`)
  assert.deepEqual(await all('SELECT kind, revokes::text[] FROM motion.issues($1)', ['m-2026-014']), [{ kind: 'end', revokes: under.map((m) => m.id) }])
})

// The walk's steps, in every browser, light and dark, each signed in as
// the person it names, a screenshot at each into `SHOTS`, its name and
// then the stage, browser and scheme.
interface Walker {
  base: string
  at: string
  page: () => Page
  as: (who: string) => Promise<void>
  open: (path: string) => Promise<void>
  shot: (name: string) => Promise<void>
}

async function walk(stage: string, steps: (w: Walker) => Promise<void>) {
  mkdirSync(shots, { recursive: true })
  for (const [engine, launch] of browsers()) {
    const browser = await launch()
    const dev = await serve()
    try {
      for (const scheme of ['light', 'dark'] as const) {
        const errors: string[] = []
        let context: BrowserContext | undefined
        let page: Page | undefined
        const at = `${stage}-${engine}-${scheme}`
        const w: Walker = {
          base: dev.base,
          at,
          page: () => page as Page,
          as: async (who) => {
            await context?.close()
            context = await browser.newContext({ viewport: { width: 1440, height: 960 }, colorScheme: scheme, extraHTTPHeaders: { 'x-forwarded-proto': 'http' } })
            await signIn(context, dev.base, who)
            page = await context.newPage()
            page.on('pageerror', (e) => errors.push(e.message))
          },
          open: async (path) => {
            await (page as Page).goto(`${dev.base}${path}`)
            await (page as Page).waitForLoadState('networkidle')
          },
          shot: async (name) => {
            await (page as Page).screenshot({ path: `${shots}/${name}-${at}.png`, fullPage: true })
          },
        }
        try {
          await steps(w)
        } finally {
          await context?.close()
        }
        assert.deepEqual(errors, [], `${at}: no page threw`)
      }
    } finally {
      await browser.close()
      await dev.stop()
    }
  }
}

const section = (page: Page, heading: string) => page.locator('section', { has: page.getByRole('heading', { name: heading }) })

// Clicks a bill's Approve and returns the refusal its page shows.
async function approving(w: Walker, bill: string) {
  await w.open(`/bills/${bill}`)
  await w.page().getByRole('button', { name: 'Approve' }).click()
  const said = w.page().getByText(/the actor holds/).first()
  await said.waitFor()
  return (await said.textContent()) ?? ''
}

// Records a bill from the Bills list's New form, as the signed-in
// person, and returns the refusal the form shows.
async function recording(w: Walker) {
  await w.open('/bills')
  await w.page().getByRole('button', { name: 'New' }).click()
  const form = w.page().locator('form', { has: w.page().getByRole('button', { name: 'Record bill' }) })
  await form.getByLabel('Supplier').fill('Imprimerie du Parc')
  await form.getByLabel('Their reference').fill('FA-2026-1203')
  await form.getByLabel('What for').fill('Proofs')
  await form.getByLabel('Line 1').fill('Proofs')
  await form.getByLabel('Unit price, €').fill('120.00')
  await form.getByRole('button', { name: 'Record bill' }).click()
  const said = w.page().getByText(/the actor holds/).first()
  await said.waitFor()
  return (await said.textContent()) ?? ''
}

unseeded('before any close: the chain, Sofia\'s powers and refusals, Brand\'s Propose… and what each open motion would do', async () => {
  const chain = (await mandate('print-buyer', 'approve-bill')).id
  const { grant, change } = await opened()
  await walk('open', async (w) => {
    await w.as(sofia)
    await w.open('/circles/brand?tab=roles')
    await Promise.all([w.page().waitForURL(`${w.base}/mandates/${chain}`), w.page().locator(`a[href="/mandates/${chain}"]`).first().click()])
    await w.page().waitForLoadState('networkidle')
    // A page is drawn once its query answers, after the address.
    await section(w.page(), 'Chain').getByText('this one').first().waitFor()
    assert.match((await section(w.page(), 'Chain').textContent()) ?? '', /this one/, `${w.at}: the chain is drawn`)
    await w.shot('1-chain')

    await w.open(`/people/${encodeURIComponent(sofia)}?tab=powers`)
    assert.match((await section(w.page(), 'Powers').textContent()) ?? '', /Approve bill/, `${w.at}: her powers list approve-bill`)
    await w.shot('2-powers')

    assert.match(await approving(w, paper), /up to 1440\.00 €: mandate \d+ grants it to print-buyer in brand up to 1200\.00 € a write/, `${w.at}: over her limit`)
    await w.shot('3-refused-over')
    assert.match(await approving(w, rent), /by no mandate covering ag's records/, `${w.at}: outside her scope`)
    await w.shot('3-refused-outside')
    assert.match(await recording(w), /no mandate for record-bill .*: it is held by finance in operations/, `${w.at}: a bill recorded`)
    await w.shot('3-refused-record')

    await w.as(camille)
    await w.open('/circles/brand')
    await w.page().getByRole('button', { name: 'Propose…' }).click()
    const form = w.page().locator('form', { has: w.page().locator('select[name="kind"] option[value="change"]') })
    await form.getByLabel('Proposes to').selectOption('grant')
    await form.getByLabel('Grantee').selectOption('role:print-buyer')
    await form.getByLabel('Power', { exact: true }).fill('record-bill')
    await form.getByLabel('Grants', { exact: true }).fill('record the print and paper bills of Brand')
    assert.match((await form.getByText(/^It will read:/).textContent()) ?? '', /The print-buyer role holds record-bill, to record the print and paper bills of Brand/, `${w.at}: the sentence as it will read`)
    await w.shot('4-propose')

    await w.open(`/mandates/${chain}`)
    await w.page().getByRole('button', { name: 'Change…' }).click()
    const changing = w.page().locator('form', { has: w.page().locator('input[name="kind"][value="change"]') })
    assert.equal(await changing.getByLabel('Power', { exact: true }).inputValue(), 'approve-bill', `${w.at}: Change… starts from its values`)
    await changing.getByLabel('Limit per write, €').fill('1500')
    assert.match((await changing.getByText(/^It will read:/).textContent()) ?? '', /The print-buyer role holds approve-bill, .*up to 1 500 € a write, in brand/, `${w.at}: the change as it will read`)
    assert.match((await changing.textContent()) ?? '', /Put to operations, which issued it/, `${w.at}: put to its issuer`)
    await w.shot('4-change-mandate')
    await w.page().keyboard.press('Escape')
    await w.page().getByRole('button', { name: 'Revoke…' }).click()
    const revoking = w.page().locator('form', { has: w.page().locator('input[name="kind"][value="revoke"]') })
    assert.match((await revoking.textContent()) ?? '', /Put to operations, which issued it; ending it revokes every mandate issued under it the same day/, `${w.at}: the revocation says what it revokes`)
    await revoking.getByLabel('Why').fill('Brand buys its print through the co-op\'s finance role from November.')
    await w.shot('4-revoke-mandate')
    await w.page().keyboard.press('Escape')

    for (const [name, id, says] of [['4-grant', grant, /grants a mandate the assembly issues, a root/], ['4-change', change, /revokes one mandate the same day, the one it replaces/], ['4-revoke', 'm-2026-014', /revokes 3 mandates the same day, the one it ends and every one issued under it/]] as const) {
      await w.open(`/motions/${id}?tab=effects`)
      const mandates = section(w.page(), 'Mandates')
      assert.match((await mandates.textContent()) ?? '', says, `${w.at}: ${name}'s page says what it does to the mandates`)
      await mandates.scrollIntoViewIfNeeded()
      await w.shot(name)
    }
  })
})

unseeded('the grant, the change and m-2026-013 close, Sofia may record and approve 1 440 €, and m-2026-014 revokes every mandate under coordination\'s the same day', async () => {
  const { grant, change } = await opened()
  // Each closed by a member seated where it was put: the change by
  // Julien, Operations' one seat.
  for (const [motion, by] of [[grant, camille], [change, julien], ['m-2026-013', camille]]) {
    settled(await close({ motion }, as(by)))
    assert.deepEqual((await carried(motion, as(by))).map((d) => [d.op, d.state]), [['motion:policy:adopt', 'settled']], motion)
  }
  const may = async (power: string, amount: number | null) =>
    (await one<{ may: boolean }>(`SELECT membership.may($1, $2, $3::bigint, 'brand', '2026-10-31') AS may`, [sofia, power, amount])).may
  assert.deepEqual([await may('record-bill', null), await may('approve-bill', 1440_00)], [true, true])
  const changed = await mandate('print-buyer', 'approve-bill')
  assert.equal(changed.limit, 150000)
  settled(await close({ motion: 'm-2026-014' }, as(camille)))
  assert.deepEqual((await carried('m-2026-014', as(camille))).map((d) => [d.op, d.state]), [['motion:policy:end', 'settled']])
  assert.deepEqual(
    await all(`SELECT grantee FROM circle.mandate WHERE power = 'approve-bill' AND revoked = '2026-10-31' ORDER BY id`),
    [{ grantee: 'coordination' }, { grantee: 'operations' }, { grantee: 'print-buyer' }, { grantee: 'print-buyer' }, { grantee: 'finance' }],
  )
  assert.deepEqual(await all(`SELECT grantee FROM circle.mandate WHERE power = 'approve-bill' AND revoked IS NULL ORDER BY id`), [{ grantee: 'manager' }])
  assert.match(reason(await approve({ bill: paper }, as(sofia))), /^the actor holds no mandate for approve-bill up to 1440\.00 €: mandate \d+ grants it to print-buyer in brand, revoked on 2026-10-31; a motion of operations granting it anew would allow it$/)
})

unseeded('two closes on one day under coordination\'s, the change and m-2026-014, each page naming only what its own close revoked', async () => {
  const { change } = await opened()
  const replaced = (await one<{ id: string }>(`SELECT m.id::text FROM circle.mandate m JOIN motion.action a ON a.args ->> 'replaces' = m.policy WHERE a.motion = $1`, [change])).id
  const revoked = await all<{ id: string }>(`SELECT id::text FROM circle.mandate WHERE power = 'approve-bill' AND revoked = '2026-10-31' AND id <> $1 ORDER BY id`, [replaced])
  assert.deepEqual(await all('SELECT closed, revokes::text[] FROM motion.issues($1)', [change]), [{ closed: true, revokes: [replaced] }])
  const [ended] = await all<{ closed: boolean; revokes: string[] }>('SELECT closed, revokes::text[] FROM motion.issues($1)', ['m-2026-014'])
  assert.equal(ended.closed, true)
  assert.deepEqual([...ended.revokes].sort(), revoked.map((m) => m.id).sort(), 'm-2026-014 names the four its close revoked, not the print buyer\'s 1 200 € the change revoked that day')
})

unseeded('after them all: m-2026-014\'s page shows what it revoked, and Sofia\'s approve of the paper bill names her mandate and the day', async () => {
  await walk('closed', async (w) => {
    await w.as(sofia)
    await w.open('/motions/m-2026-014?tab=effects')
    const mandates = section(w.page(), 'Mandates')
    assert.match((await mandates.textContent()) ?? '', /revoked 4 mandates the same day, the one it ends and every one issued under it/, `${w.at}: the cascade`)
    await mandates.scrollIntoViewIfNeeded()
    await w.shot('5-revoked')
    assert.match(await approving(w, paper), /revoked on 2026-10-31/, `${w.at}: the refusal names the day`)
    await w.shot('5-refused-revoked')
  })
})

test('the log verifies', async () => {
  assert.equal((await one<{ v: boolean }>('SELECT cella.verify_log() AS v')).v, true)
})

if (!process.env.CELLA_STORY) runTest('authority-walk story', async (t) => story((name, step) => t.test(name, step)))
