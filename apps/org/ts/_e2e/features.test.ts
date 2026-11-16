// The features scenario, in every browser, light and dark, on a seeded
// Lanterne through the dev server: Léa, a member of Web, opens Web's
// Settings tab and follows it to Web's features page,
// `/settings/features/web`: the tree of Web's features in its order, the
// rest not shown, no toggle, no field naming an accordion and no Save
// button, and beside the label the motion icon naming Web. By the
// keyboard she lifts Invoice from those not shown with Space, moves it up
// with an arrow, each place announced, and drops it at the end of the
// tree: no dialog opens, and the change joins the changes to propose to
// Web, since Web holds `arrange-features` over itself. She reviews it,
// the diff marking Invoice added, and proposes Web's own motion carrying
// the listing with Invoice at its end, whose page shows the diff on its
// Overview; every member of Web consents, and on its deadline she closes
// it: its Effects show the diff from what the close replaced, and the
// page reads Web's new set; and Operations' page shows its features under its accordions.
// Then Yusuf, Web's lead, who holds `arrange-features` over Web by his
// seat, drags Invoice by the pointer down among those not shown, which
// saves at once, with no motion. `SHOTS` names where its screenshots go.
// Run by `cella test e2e features`.

// browsers: one at a time: each browser changes Web's features by Web's motion and the scope's clock, which the others read
// covers: membership-motion motion core

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import pg from 'pg'
import type { Page } from 'playwright-core'
import { vote } from '@cella/org-motion/api'
import { carried, close } from '@cella/org-graft-membership-motion/api'
import type { Deps, Done } from '@cella/org-db'
import { reader, sign } from './lanterne.ts'
import { eachBrowser, serve, signIn } from './browser.ts'
import { basket, chosen, review } from './controls.ts'

const su = new pg.Client()
let app: pg.Client | undefined

const shots = process.env.SHOTS ?? '/tmp/cella-features-shots'
const lea = 'lea@lanterne.example'
const yusuf = 'yusuf@lanterne.example'
const web = 'project, task, timesheet, file, contact'
const arranged = 'project, task, timesheet, file, contact, invoice'
let today = '2026-11-09'
// The motions proposed from the page, so each run finds its own.
const seen: string[] = []

async function on(date: string) {
  today = date
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
const states = (out: Done[]) => out.map((d) => [d.op, d.state, d.reason ?? ''])

// Every member on the motion's roll consents, and on its deadline Léa
// closes it; what its close carried.
async function decided(motion: string) {
  for (const { member } of await all<{ member: string }>('SELECT member FROM motion.roll WHERE motion = $1', [motion])) {
    settled(await vote({ motion, member, stance: 'consent' }, as(member)))
  }
  const { deadline } = await one<{ deadline: string }>(`SELECT to_char(deadline, 'YYYY-MM-DD') AS deadline FROM motion.motion WHERE id = $1`, [motion])
  await on(deadline)
  settled(await close({ motion }, as(lea)))
  return carried(motion, as(lea))
}

// The features the page shows on, in its order, once it has drawn them.
async function shown(page: Page) {
  const tree = page.locator('fieldset.arrange ul.tree')
  await tree.locator('li.choice').first().waitFor()
  return (await tree.locator('li.choice .text').allTextContents()).map((t) => t.trim()).join(', ')
}

// Drags a feature's grip by the pointer onto a target, in small steps,
// as a person's hand moves.
async function drag(page: Page, feature: string, target: ReturnType<Page['locator']>) {
  const grip = page.getByRole('button', { name: `Reorder ${feature}` })
  const from = (await grip.boundingBox())!
  const to = (await target.boundingBox())!
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
  await page.mouse.down()
  for (let i = 1; i <= 12; i++) {
    await page.mouse.move(from.x + ((to.x + to.width / 2 - from.x) * i) / 12, from.y + ((to.y + to.height / 2 - from.y) * i) / 12)
  }
  await page.mouse.up()
}

before(async () => {
  await su.connect()
  await on(today)
})

after(async () => {
  await app?.end()
  await su.end()
})

eachBrowser((name, launch) => {
  test(`${name}: Léa enables Invoice for Web from Web's features page by Web's own motion, and Yusuf, its lead, disables it at once, light and dark`, async () => {
    mkdirSync(shots, { recursive: true })
    const browser = await launch()
    try {
      for (const scheme of ['light', 'dark'] as const) {
        const at = `${name}, ${scheme}`
        assert.equal((await one<{ f: string }>(`SELECT circle.features('web') AS f`)).f, web, `${at}: Web's features as Lanterne enables them`)
        const dev = await serve()
        const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: scheme, extraHTTPHeaders: { 'x-forwarded-proto': 'http' } })
        try {
          await signIn(context, dev.base, lea)
          const page = await context.newPage()
          const errors: string[] = []
          page.on('pageerror', (e) => errors.push(e.message))
          await page.goto(`${dev.base}/circles/web?tab=settings`)
          await page.waitForLoadState('networkidle')
          await page.getByRole('link', { name: 'Choose its features' }).click()
          await page.waitForURL(`${dev.base}/settings/features/web`)
          await page.waitForLoadState('networkidle')

          assert.equal(await page.getByRole('link', { name: 'Back to app' }).count(), 1, `${at}: Settings' sidebar stands`)
          const form = page.locator('form.settings')
          assert.equal(await shown(page), 'Project, Task, Timesheet, File, Contact', `${at}: Web's features on, in its order`)
          const off = form.locator('fieldset.arrange .off')
          assert.match((await off.textContent()) ?? '', /Not shown.*Invoice/s, `${at}: an installed feature Web does not show is among those not shown`)
          assert.match((await off.textContent()) ?? '', /Circle/, `${at}: core's collections are features too`)
          assert.equal(await form.getByRole('switch').count(), 0, `${at}: no toggles`)
          assert.equal(await form.getByLabel(/^Accordion of/).count(), 0, `${at}: no field names a feature's accordion`)
          assert.equal(await form.getByRole('button', { name: 'Web changes this by motion' }).count(), 1, `${at}: Web's own motion changes them, says the icon`)
          assert.equal(await form.getByRole('button', { name: /^Move/ }).count(), 0, `${at}: no arrows`)
          await page.screenshot({ path: `${shots}/features-${name}-${scheme}.png`, fullPage: true })

          assert.equal(await page.getByRole('button', { name: /^Save/ }).count(), 0, `${at}: the page has no Save button`)
          // By the keyboard: Invoice lifted from those not shown, up one
          // place to the end of the tree, and dropped.
          const grip = form.getByRole('button', { name: 'Reorder Invoice' })
          await grip.focus()
          await grip.press('Space')
          await page.locator('fieldset.arrange .place[data-drop-place]').first().waitFor({ state: 'attached' })
          await grip.press('ArrowUp')
          await page.getByText('At the top level, after Contact').first().waitFor({ state: 'attached' })
          await grip.press('Space')
          await basket(page, 'Web').waitFor()
          assert.equal(await page.getByRole('dialog').count(), 0, `${at}: a drop opens no dialog`)
          assert.equal(await shown(page), 'Project, Task, Timesheet, File, Contact, Invoice', `${at}: Invoice on at the end`)
          assert.equal(await form.getByRole('button', { name: 'Proposed to Web' }).count(), 1, `${at}: the icon says it waits to be proposed`)
          const dialog = await review(page, 'Web')
          assert.match((await dialog.locator('figure.diff').textContent()) ?? '', /Invoice\s*added/, `${at}: the diff marks Invoice added`)
          assert.equal(await dialog.getByLabel('Title').inputValue(), 'Enable Invoice for Web', `${at}: its title says the change`)
          assert.equal(await chosen(dialog.getByLabel('Circle')), 'web', `${at}: put to Web itself, not the assembly`)
          await page.screenshot({ path: `${shots}/features-propose-${name}-${scheme}.png` })
          await dialog.getByRole('button', { name: 'Propose it to Web' }).click()
          await dialog.waitFor({ state: 'hidden' })

          const { motion } = await one<{ motion: string }>(
            `SELECT motion FROM motion.action WHERE kind = 'arrange-features' AND args ->> 'features' = $1 AND motion <> ALL ($2::text[])`,
            [arranged, seen],
          )
          seen.push(motion)
          assert.deepEqual(
            await one(`SELECT d.circle, d.title, m.args FROM motion.motion d JOIN motion.action m ON m.motion = d.id WHERE d.id = $1`, [motion]),
            { circle: 'web', title: 'Enable Invoice for Web', args: { circle: 'web', features: arranged } },
            `${at}: Web's own motion changes Web's features`,
          )
          assert.equal((await one<{ f: string }>(`SELECT circle.features('web') AS f`)).f, web, `${at}: nothing changes until the motion carries`)
          // The motion's page shows what it changes as the tree's diff, on
          // its Overview while open and on its Effects once closed.
          const diffOn = async (path: string, heading: string) => {
            await page.goto(`${dev.base}${path}`)
            await page.waitForLoadState('networkidle')
            const section = page.locator('section', { has: page.getByRole('heading', { name: heading }) })
            await section.waitFor()
            return (await section.locator('figure.diff').textContent()) ?? ''
          }
          assert.match(await diffOn(`/motions/${motion}`, 'What it changes'), /Web's features.*Contact.*Invoice\s*added/s, `${at}: the Overview shows the diff`)
          await page.screenshot({ path: `${shots}/features-motion-${name}-${scheme}.png`, fullPage: true })
          assert.deepEqual(states(await decided(motion)), [['circle:circle:arrange', 'settled', '']], `${at}: its close changes Web's features`)
          assert.match(await diffOn(`/motions/${motion}?tab=effects`, 'What it changed'), /Invoice\s*added/, `${at}: Effects shows it from what the close replaced`)

          await page.goto(`${dev.base}/settings/features/web`)
          await page.waitForLoadState('networkidle')
          assert.equal(await shown(page), 'Project, Task, Timesheet, File, Contact, Invoice', `${at}: the page reads Web's new set after a reload`)
          await page.screenshot({ path: `${shots}/features-carried-${name}-${scheme}.png`, fullPage: true })

          await page.goto(`${dev.base}/settings/features/operations`)
          await page.waitForLoadState('networkidle')
          assert.equal(
            await shown(page),
            'Account, Transaction, Report, Import, Invoice, Bill, Expense, Payslip, Contact, Employment',
            `${at}: Operations' features in its order`,
          )
          assert.equal(await page.getByLabel('Name of the Books accordion').inputValue(), 'Books', `${at}: under its accordions`)
          assert.match((await page.locator('li.choice', { hasText: 'Invoice' }).textContent()) ?? '', /in Payments/, `${at}: each feature in its own`)
          await page.screenshot({ path: `${shots}/features-operations-${name}-${scheme}.png`, fullPage: true })
          assert.deepEqual(errors, [], `${at}: the page threw nothing`)

        } finally {
          await context.close()
        }

        // Yusuf, Web's lead, holds arrange-features over Web by his seat:
        // the page saves his drop at once, with no motion.
        const lead = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: scheme, extraHTTPHeaders: { 'x-forwarded-proto': 'http' } })
        try {
          await signIn(lead, dev.base, yusuf)
          const page = await lead.newPage()
          await page.goto(`${dev.base}/settings/features/web`)
          await page.waitForLoadState('networkidle')
          const form = page.locator('form.settings')
          assert.equal(await form.getByRole('button', { name: /changes this by motion/ }).count(), 0, `${at}: Web's lead changes them himself, and the field wears no icon`)
          const motions = (await one<{ n: number }>(`SELECT count(*)::int AS n FROM motion.motion`)).n
          await drag(page, 'Invoice', form.locator('fieldset.arrange .off'))
          for (let i = 0; i < 50 && (await one<{ f: string }>(`SELECT circle.features('web') AS f`)).f !== web; i++) {
            await page.waitForTimeout(100)
          }
          assert.equal((await one<{ f: string }>(`SELECT circle.features('web') AS f`)).f, web, `${at}: his toggle saves Web's features at once`)
          assert.equal(await page.getByRole('dialog').count(), 0, `${at}: no dialog asks for a motion`)
          assert.equal((await one<{ n: number }>(`SELECT count(*)::int AS n FROM motion.motion`)).n, motions, `${at}: and no motion is proposed`)
          assert.equal((await one<{ op: string }>(`SELECT op FROM cella.log ORDER BY n DESC LIMIT 1`)).op, 'circle:feature:arrange')
          await page.screenshot({ path: `${shots}/features-lead-${name}-${scheme}.png`, fullPage: true })
        } finally {
          await lead.close()
          await dev.stop()
        }
      }
    } finally {
      await browser.close()
    }
  })
})
