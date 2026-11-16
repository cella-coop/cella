// The features scenario, in every browser, light and dark, on a seeded
// Lanterne through the dev server: Camille opens Web's Settings tab and
// follows it to Web's features page, `/settings/features/web`, every
// installed feature with a toggle, Web's on in its order, and no Save
// button. She turns Invoice on, and the dialog offers the motion at
// once; Cancel takes the change back. She turns it on again; the dialog
// says why no write of hers changes Web's features and offers the
// assembly's `amend-circle` motion, carrying the listing with Invoice
// at its end. She proposes it, every member consents, and on its
// deadline she closes it: after a reload the page reads Web's new set; and
// Operations' page shows its features under its accordions. The
// assembly then puts Web's features back as they were. `SHOTS` names
// where its screenshots go. Run by `cella test e2e features`.

// browsers: one at a time: each browser changes Web's features and the scope's clock by the assembly's motions, which the others read
// covers: membership-motion motion

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import pg from 'pg'
import type { Page } from 'playwright-core'
import { vote } from '@cella/org-motion/api'
import { carried, close, propose } from '@cella/org-graft-membership-motion/api'
import type { Deps, Done } from '@cella/org-db'
import { reader, sign } from './lanterne.ts'
import { eachBrowser, serve, signIn } from './browser.ts'

const su = new pg.Client()
let app: pg.Client | undefined

const shots = process.env.SHOTS ?? '/tmp/cella-features-shots'
const camille = 'camille@lanterne.example'
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

// Every member on the motion's roll consents, and on its deadline Camille
// closes it; what its close carried.
async function decided(motion: string) {
  for (const { member } of await all<{ member: string }>('SELECT member FROM motion.roll WHERE motion = $1', [motion])) {
    settled(await vote({ motion, member, stance: 'consent' }, as(member)))
  }
  const { deadline } = await one<{ deadline: string }>(`SELECT to_char(deadline, 'YYYY-MM-DD') AS deadline FROM motion.motion WHERE id = $1`, [motion])
  await on(deadline)
  settled(await close({ motion }, as(camille)))
  return carried(motion, as(camille))
}

// The features the page shows on, in its order, once it has drawn them.
async function shown(page: Page) {
  const on = page.locator('fieldset.arrange ul.on')
  await on.getByRole('switch').first().waitFor()
  return (await on.getByRole('switch').evaluateAll((els) => els.map((e) => e.closest('label')?.textContent?.trim() ?? ''))).join(', ')
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
  test(`${name}: Camille enables Invoice for Web and moves Contact up from Web's features page, by the assembly's motion, light and dark`, async () => {
    mkdirSync(shots, { recursive: true })
    const browser = await launch()
    try {
      for (const scheme of ['light', 'dark'] as const) {
        const at = `${name}, ${scheme}`
        assert.equal((await one<{ f: string }>(`SELECT circle.features('web') AS f`)).f, web, `${at}: Web's features as Lanterne enables them`)
        const dev = await serve()
        const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: scheme, extraHTTPHeaders: { 'x-forwarded-proto': 'http' } })
        try {
          await signIn(context, dev.base, camille)
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
          assert.equal(await form.getByRole('switch', { name: 'Invoice' }).isChecked(), false, `${at}: an installed feature Web has not enabled is off`)
          assert.equal(await form.getByRole('switch', { name: 'Circle' }).isChecked(), false, `${at}: core's collections are features too`)
          assert.equal(await form.getByText('Assembly changes it by motion').count(), 1, `${at}: the assembly's motion changes them`)
          assert.equal(await form.getByRole('button', { name: 'Move Project up' }).isDisabled(), true, `${at}: the first moves up no further`)
          await page.screenshot({ path: `${shots}/features-${name}-${scheme}.png`, fullPage: true })

          assert.equal(await page.getByRole('button', { name: /^Save/ }).count(), 0, `${at}: the page has no Save button`)
          await form.getByRole('switch', { name: 'Invoice' }).click()
          const dialog = page.getByRole('dialog', { name: 'Assembly changes it by motion' })
          await dialog.waitFor()
          assert.equal(await dialog.getByLabel('Title').inputValue(), 'Enable Invoice for Web', `${at}: a toggle, made, offers the motion`)
          await dialog.getByRole('button', { name: 'Cancel' }).click()
          await dialog.waitFor({ state: 'hidden' })
          assert.equal(await form.getByRole('switch', { name: 'Invoice' }).isChecked(), false, `${at}: Cancel takes the change back`)
          await form.getByRole('switch', { name: 'Invoice' }).click()
          await dialog.waitFor()
          assert.equal(await shown(page), 'Project, Task, Timesheet, File, Contact, Invoice', `${at}: Invoice on at the end`)
          assert.ok(
            ((await dialog.textContent()) ?? '').includes("Web's features change only by a motion of Assembly, which holds amend-circle: no one's own write changes them"),
            `${at}: the dialog says why her write changes nothing`,
          )
          assert.equal(await dialog.getByLabel('Title').inputValue(), 'Enable Invoice for Web', `${at}: its title says the change`)
          assert.equal(await dialog.getByLabel('Circle').inputValue(), 'ag', `${at}: put to the assembly`)
          assert.equal(await dialog.getByLabel('New features').inputValue(), arranged, `${at}: the listing as she arranged it`)
          await page.screenshot({ path: `${shots}/features-propose-${name}-${scheme}.png` })
          await dialog.getByRole('button', { name: 'Propose to Assembly' }).click()
          await dialog.waitFor({ state: 'hidden' })

          const { motion } = await one<{ motion: string }>(
            `SELECT motion FROM motion.action WHERE kind = 'amend-circle' AND args ->> 'features' = $1 AND motion <> ALL ($2::text[])`,
            [arranged, seen],
          )
          seen.push(motion)
          assert.deepEqual(
            await one(`SELECT d.circle, d.title, m.args FROM motion.motion d JOIN motion.action m ON m.motion = d.id WHERE d.id = $1`, [motion]),
            { circle: 'ag', title: 'Enable Invoice for Web', args: { circle: 'web', features: arranged } },
            `${at}: the assembly's motion changes Web's features`,
          )
          assert.equal((await one<{ f: string }>(`SELECT circle.features('web') AS f`)).f, web, `${at}: nothing changes until the motion carries`)
          assert.deepEqual(states(await decided(motion)), [['circle:circle:amend', 'settled', '']], `${at}: its close changes Web's features`)

          await page.reload()
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
          assert.equal(await page.getByLabel('Accordion Books').inputValue(), 'Books', `${at}: under its accordions`)
          assert.equal(await page.getByLabel('Accordion of Invoice').inputValue(), 'Payments', `${at}: each feature naming its own`)
          assert.equal(await page.getByRole('button', { name: 'Move the Books accordion up' }).isDisabled(), true, `${at}: the first accordion moves up no further`)
          await page.screenshot({ path: `${shots}/features-operations-${name}-${scheme}.png`, fullPage: true })
          assert.deepEqual(errors, [], `${at}: the page threw nothing`)

          const back = settled(
            await propose({ circle: 'ag', title: 'Put Web back', deadline: new Date(Date.parse(`${today}T00:00:00Z`) + 14 * 86400000).toISOString().slice(0, 10), body: '', actions: [{ kind: 'amend-circle', args: { circle: 'web', features: web } }] }, as(camille)),
          ) as { motion: string }
          assert.deepEqual(states(await decided(back.motion)), [['circle:circle:amend', 'settled', '']], `${at}: the assembly puts Web's features back`)
        } finally {
          await context.close()
          await dev.stop()
        }
      }
    } finally {
      await browser.close()
    }
  })
})
