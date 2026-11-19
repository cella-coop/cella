// The features scenario, in every browser, light and dark, on a seeded
// Lanterne through the dev server. Léa, a member of Web, opens Web's
// Settings tab and follows it to Web's features page,
// `/settings/features/web`: the coop's groups in the layout's order,
// each with a switch, Work's on, and under each its features, a feature
// of a group Web does not show waiting on it; no arrangement, no Save
// button, how to use it an icon's tooltip, and beside each the motion
// icon naming Web. She switches Payments on: no dialog opens, and the
// change joins the changes to propose to Web, since Web holds
// `arrange-features` over itself. She reviews and proposes Web's own
// motion showing Payments; every member of Web consents, and on its
// deadline she closes it, and the page reads Payments shown with its
// features. Then Yusuf, Web's lead, who holds `arrange-features` over
// Web by his seat, switches Invoice off and Payments off, each saved at
// once, with no motion. Then Camille opens the root's page, the coop's
// layout: every feature under a group, none left out, the assembly's
// motion arranging it; she renames Work Studio, proposes it to the
// assembly, which consents, and Web's page shows Studio switched on.
// `SHOTS` names where its screenshots go. Run by `cella test e2e
// features`.

// browsers: one at a time: each browser changes Web's features by Web's motion, the coop's layout by the assembly's and the scope's clock, which the others read
// covers: membership-motion motion core

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import pg from 'pg'
import type { Page } from 'playwright-core'
import { vote } from '@cella/org-motion/api'
import { hide } from '@cella/org-circle/api'
import { carried, close, propose } from '@cella/org-graft-membership-motion/api'
import type { Deps, Done } from '@cella/org-db'
import { reader, sign } from './lanterne.ts'
import { eachBrowser, serve, signIn } from './browser.ts'
import { basket, chosen, review } from './controls.ts'

const su = new pg.Client()
let app: pg.Client | undefined

const shots = process.env.SHOTS ?? '/tmp/cella-features-shots'
const lea = 'lea@lanterne.example'
const yusuf = 'yusuf@lanterne.example'
const camille = 'camille@lanterne.example'
const web = 'Work: project, task, timesheet, document, file, contact'
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
const fortnight = () => new Date(Date.parse(`${today}T00:00:00Z`) + 14 * 86400000).toISOString().slice(0, 10)

// Every member on the motion's roll consents, and on its deadline
// `closer`, Camille unless named, closes it; what its close carried.
async function decided(motion: string, closer = camille) {
  for (const { member } of await all<{ member: string }>('SELECT member FROM motion.roll WHERE motion = $1', [motion])) {
    settled(await vote({ motion, member, stance: 'consent' }, as(member)))
  }
  const { deadline } = await one<{ deadline: string }>(`SELECT to_char(deadline, 'YYYY-MM-DD') AS deadline FROM motion.motion WHERE id = $1`, [motion])
  await on(deadline)
  settled(await close({ motion }, as(closer)))
  return carried(motion, as(closer))
}

// The groups the page lists, in order, by their switches.
const groups = (page: Page) => page.locator('form.settings .setting.toggle:not(.inner) [role=switch] .text').allTextContents()

// Whether the switch of that name is on.
const on_ = async (page: Page, label: string) =>
  (await page.locator('form.settings').getByRole('switch', { name: label, exact: true }).getAttribute('aria-checked')) === 'true'

// The features the layout's page shows enabled, in its order.
async function shown(page: Page) {
  const tree = page.locator('fieldset.arrange ul.tree')
  await tree.locator('li.choice').first().waitFor()
  return (await tree.locator('li.choice .text').allTextContents()).map((t) => t.trim()).join(', ')
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
  test(`${name}: Léa shows Payments in Web from Web's features page by Web's own motion, Yusuf, its lead, hides Invoice and Payments at once, and the assembly renames Work, light and dark`, async () => {
    mkdirSync(shots, { recursive: true })
    const browser = await launch()
    try {
      for (const scheme of ['light', 'dark'] as const) {
        const at = `${name}, ${scheme}`
        assert.equal((await one<{ f: string }>(`SELECT circle.features('web') AS f`)).f, web, `${at}: Web's features as Lanterne shows them`)
        const layout = (await one<{ f: string }>(`SELECT circle.features('ag') AS f`)).f
        const dev = await serve()
        try {
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
            await form.getByRole('switch').first().waitFor()
            assert.deepEqual(await groups(page), ['Organization', 'Work', 'Books', 'Payments', 'Membership'], `${at}: the layout's groups, in its order`)
            assert.equal(await on_(page, 'Work'), true, `${at}: Web shows Work`)
            assert.equal(await on_(page, 'Payments'), false, `${at}: and not Payments`)
            assert.equal(await on_(page, 'Project'), true, `${at}: nor hides a feature of Work`)
            assert.equal(await form.getByRole('switch', { name: 'Invoice', exact: true }).isDisabled(), true, `${at}: a feature of a group Web does not show waits for it`)
            assert.equal(await form.locator('fieldset.arrange').count(), 0, `${at}: no arrangement: a circle never moves a feature`)
            assert.ok((await form.getByRole('button', { name: 'Web changes this by motion' }).count()) > 0, `${at}: Web's own motion changes them, says the icon`)
            assert.equal(await form.getByRole('button', { name: /^How to change/ }).count(), 1, `${at}: how to use it is an icon's tooltip`)
            assert.equal(await page.getByRole('button', { name: /^Save/ }).count(), 0, `${at}: the page has no Save button`)
            await page.screenshot({ path: `${shots}/features-${name}-${scheme}.png`, fullPage: true })

            // Payments switched on: it joins the changes to propose to Web.
            await form.getByRole('switch', { name: 'Payments', exact: true }).click()
            await basket(page, 'Web').waitFor()
            assert.equal(await page.getByRole('dialog').count(), 0, `${at}: a turn opens no dialog`)
            assert.equal(await on_(page, 'Payments'), true, `${at}: Payments on, waiting`)
            const dialog = await review(page, 'Web')
            assert.equal(await dialog.getByLabel('Title').inputValue(), 'Show Payments in Web', `${at}: its title says the change`)
            assert.equal(await chosen(dialog.getByLabel('Circle')), 'web', `${at}: put to Web itself, not the assembly`)
            await page.screenshot({ path: `${shots}/features-propose-${name}-${scheme}.png` })
            await dialog.getByRole('button', { name: 'Propose it to Web' }).click()
            await dialog.waitFor({ state: 'hidden' })

            const { motion } = await one<{ motion: string }>(
              `SELECT motion FROM motion.action WHERE kind = 'show-group' AND args ->> 'circle' = 'web' AND motion <> ALL ($1::text[])`,
              [seen],
            )
            seen.push(motion)
            assert.deepEqual(
              await one(`SELECT d.circle, d.title, m.args FROM motion.motion d JOIN motion.action m ON m.motion = d.id WHERE d.id = $1`, [motion]),
              { circle: 'web', title: 'Show Payments in Web', args: { circle: 'web', group: 'payments', shown: 'yes' } },
              `${at}: Web's own motion shows a group of the layout in Web`,
            )
            assert.equal((await one<{ f: string }>(`SELECT circle.features('web') AS f`)).f, web, `${at}: nothing changes until the motion carries`)
            assert.deepEqual(states(await decided(motion, lea)), [['circle:circle:show', 'settled', '']], `${at}: its close shows Payments in Web`)
            await page.goto(`${dev.base}/settings/features/web`)
            await page.waitForLoadState('networkidle')
            await form.getByRole('switch').first().waitFor()
            assert.equal(await on_(page, 'Payments'), true, `${at}: the page reads Payments shown after a reload`)
            assert.equal(await on_(page, 'Invoice'), true, `${at}: and its features with it`)
            assert.equal((await one<{ f: string }>(`SELECT circle.features('web') AS f`)).f, `${web}; Payments: invoice, bill, expense, payslip`)
            assert.deepEqual(errors, [], `${at}: the page threw nothing`)
          } finally {
            await context.close()
          }

          // Yusuf, Web's lead, holds arrange-features over Web by his seat:
          // each turn saves at once, with no motion.
          const lead = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: scheme, extraHTTPHeaders: { 'x-forwarded-proto': 'http' } })
          try {
            await signIn(lead, dev.base, yusuf)
            const page = await lead.newPage()
            await page.goto(`${dev.base}/settings/features/web`)
            await page.waitForLoadState('networkidle')
            const form = page.locator('form.settings')
            await form.getByRole('switch').first().waitFor()
            assert.equal(await form.getByRole('button', { name: /changes this by motion/ }).count(), 0, `${at}: Web's lead changes them himself, and no switch wears the icon`)
            const motions = (await one<{ n: number }>(`SELECT count(*)::int AS n FROM motion.motion`)).n
            const until = async (f: string) => {
              for (let i = 0; i < 50 && (await one<{ f: string }>(`SELECT circle.features('web') AS f`)).f !== f; i++) {
                await page.waitForTimeout(100)
              }
              return (await one<{ f: string }>(`SELECT circle.features('web') AS f`)).f
            }
            await form.getByRole('switch', { name: 'Invoice', exact: true }).click()
            assert.equal(await until(`${web}; Payments: bill, expense, payslip`), `${web}; Payments: bill, expense, payslip`, `${at}: his turn hides Invoice in Web at once`)
            assert.equal((await one<{ op: string }>(`SELECT op FROM cella.log ORDER BY n DESC LIMIT 1`)).op, 'circle:feature:hide')
            await form.getByRole('switch', { name: 'Payments', exact: true }).click()
            assert.equal(await until(web), web, `${at}: and Payments`)
            assert.equal((await one<{ op: string }>(`SELECT op FROM cella.log ORDER BY n DESC LIMIT 1`)).op, 'circle:group:show')
            await form.getByRole('switch', { name: 'Invoice', exact: true }).waitFor()
            assert.equal(await page.getByRole('dialog').count(), 0, `${at}: no dialog asks for a motion`)
            assert.equal((await one<{ n: number }>(`SELECT count(*)::int AS n FROM motion.motion`)).n, motions, `${at}: and no motion is proposed`)
            await page.screenshot({ path: `${shots}/features-lead-${name}-${scheme}.png`, fullPage: true })
            // Invoice shown again, while Payments is hidden.
            settled(await hide({ circle: 'web', feature: 'invoice', hidden: false }, as(yusuf)))
          } finally {
            await lead.close()
          }

          // Camille, on the root's page, the coop's layout: every feature
          // under a group, renamed by the assembly's motion; Web still shows
          // the group it showed, under its new name.
          const member = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: scheme, extraHTTPHeaders: { 'x-forwarded-proto': 'http' } })
          try {
            await signIn(member, dev.base, camille)
            const page = await member.newPage()
            await page.goto(`${dev.base}/settings/features/ag`)
            await page.waitForLoadState('networkidle')
            const form = page.locator('form.settings')
            assert.equal(await shown(page), 'Circle, Person, Motion, Meeting, Policy, Project, Task, Timesheet, Document, File, Contact, Account, Transaction, Report, Import, Invoice, Bill, Expense, Payslip, Membership, Patronage, Employment', `${at}: the layout, in its order`)
            assert.equal(await form.getByLabel('Name of the Books group').inputValue(), 'Books', `${at}: under its groups`)
            assert.match((await form.locator('fieldset.arrange .off').textContent()) ?? '', /Not enabled.*Every feature is enabled/s, `${at}: what it leaves out is enabled nowhere`)
            assert.equal(await form.getByRole('button', { name: 'Assembly changes this by motion' }).count(), 1, `${at}: the assembly's motion arranges it`)
            await page.screenshot({ path: `${shots}/features-layout-${name}-${scheme}.png`, fullPage: true })
            const name_ = form.getByLabel('Name of the Work group')
            await name_.fill('Studio')
            await name_.press('Enter')
            await basket(page, 'Assembly').waitFor()
            const dialog = await review(page, 'Assembly')
            assert.equal(await dialog.getByLabel('Title').inputValue(), 'Rearrange the coop\'s features', `${at}: its title says the change`)
            await dialog.getByRole('button', { name: 'Propose it to Assembly' }).click()
            await dialog.waitFor({ state: 'hidden' })
            const { motion } = await one<{ motion: string }>(
              `SELECT motion FROM motion.action WHERE kind = 'arrange-features' AND motion <> ALL ($1::text[])`,
              [seen],
            )
            seen.push(motion)
            assert.deepEqual(states(await decided(motion)), [['circle:circle:arrange', 'settled', '']], `${at}: its close renames Work`)
            assert.equal((await one<{ f: string }>(`SELECT circle.features('web') AS f`)).f, web.replace('Work:', 'Studio:'), `${at}: Web still shows it, as Studio`)
            await page.goto(`${dev.base}/settings/features/web`)
            await page.waitForLoadState('networkidle')
            await form.getByRole('switch').first().waitFor()
            assert.equal(await on_(page, 'Studio'), true, `${at}: Web's page shows Studio switched on`)
            // The layout as it was, for the next run.
            const back = settled(
              await propose({ circle: 'ag', title: 'Back', deadline: fortnight(), body: '', actions: [{ kind: 'arrange-features', args: { circle: 'ag', features: layout } }] }, as(camille)),
            ) as { motion: string }
            seen.push(back.motion)
            assert.deepEqual(states(await decided(back.motion)), [['circle:circle:arrange', 'settled', '']])
          } finally {
            await member.close()
          }
        } finally {
          await dev.stop()
        }
      }
    } finally {
      await browser.close()
    }
  })
})
