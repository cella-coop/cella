// The co-op's layout scenario, in every browser, on a seeded Lanterne
// through the dev server: the co-op lays its features out once, at its
// root, and each circle only drops what it does not show. Camille looks
// through Web and through Tools: both show Project, Task and Timesheet,
// in Work, in the same order. Yusuf, Web's lead, hides Timesheet in Web
// at once: Web's sidebar drops it, and Tools' keeps it. The assembly
// renames Work to Studio by motion: Web and Tools still show the group,
// now Studio, Web still without Timesheet. Each browser then puts the
// layout and Web back. Run by `cella test e2e layout`.

// browsers: one at a time: each browser hides a feature in Web and renames a group of the co-op's layout by the assembly's motion, which the others read
// covers: membership-motion motion core

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import type { Page } from 'playwright-core'
import { vote } from '@cella/org-motion/api'
import { hide } from '@cella/org-circle/api'
import { carried, close, propose } from '@cella/org-graft-membership-motion/api'
import type { Deps, Done } from '@cella/org-db'
import { reader, sign } from './lanterne.ts'
import { eachBrowser, serve, signIn } from './browser.ts'

const su = new pg.Client()
let app: pg.Client | undefined

const camille = 'camille@lanterne.example'
const yusuf = 'yusuf@lanterne.example'
let today = '2026-11-09'

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

// The assembly lays the co-op's features out as `features` by its
// motion, Camille proposing it and closing it on its deadline once every
// member consents.
async function laid(features: string) {
  const { motion } = settled(
    await propose({ circle: 'ag', title: 'Arrange the co-op\'s features', deadline: fortnight(), body: '', actions: [{ kind: 'arrange-features', args: { circle: 'ag', features } }] }, as(camille)),
  ) as { motion: string }
  for (const { member } of await all<{ member: string }>('SELECT member FROM motion.roll WHERE motion = $1', [motion])) {
    settled(await vote({ motion, member, stance: 'consent' }, as(member)))
  }
  const { deadline } = await one<{ deadline: string }>(`SELECT to_char(deadline, 'YYYY-MM-DD') AS deadline FROM motion.motion WHERE id = $1`, [motion])
  await on(deadline)
  settled(await close({ motion }, as(camille)))
  assert.deepEqual(states(await carried(motion, as(camille))), [['circle:circle:arrange', 'settled', '']])
}

// The sidebar's middle as drawn through `circle`, every group opened, as
// runs: each group's name and its collections.
async function drawn(page: Page, base: string, circle: string): Promise<Record<string, string[]>> {
  await page.context().addCookies([{ name: 'cella-lens', value: circle, url: base }])
  await page.goto(`${base}/inbox`)
  await page.waitForLoadState('networkidle')
  const middle = page.getByRole('navigation', { name: 'Main' }).locator('.middle')
  const shut = middle.locator('button.head[aria-expanded="false"]')
  for (let left = 20; left > 0 && (await shut.count()) > 0; left--) {
    await shut.first().click()
  }
  const items = await middle.locator('button.head, ul a').evaluateAll((els) =>
    els.map((e) => (e.tagName === 'BUTTON' ? `[${e.querySelector('.title')?.textContent?.trim()}]` : e.getAttribute('href')!)),
  )
  const runs: Record<string, string[]> = {}
  let group = ''
  for (const item of items) {
    if (item.startsWith('[')) {
      group = item.slice(1, -1)
      runs[group] = []
    } else {
      runs[group]?.push(item)
    }
  }
  return runs
}

// What two runs share, in the order of the first.
const shared = (a: string[], b: string[]) => a.filter((x) => b.includes(x))

before(async () => {
  await su.connect()
  await on(today)
})

after(async () => {
  await app?.end()
  await su.end()
})

eachBrowser((name, launch) => {
  test(`${name}: two circles show a feature in the same group and order; one hiding it drops it there only; a group renamed keeps each circle's choice`, async () => {
    const layout = (await one<{ f: string }>(`SELECT circle.features('ag') AS f`)).f
    const browser = await launch()
    const dev = await serve()
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, extraHTTPHeaders: { 'x-forwarded-proto': 'http' } })
    try {
      await signIn(context, dev.base, camille)
      const page = await context.newPage()
      const errors: string[] = []
      page.on('pageerror', (e) => errors.push(`${page.url()}: ${e.message}`))

      const web = await drawn(page, dev.base, 'web')
      const tools = await drawn(page, dev.base, 'tools')
      assert.deepEqual(web.Work, ['/projects', '/tasks', '/timesheets', '/contacts'], `${name}: Web shows Work`)
      assert.deepEqual(tools.Work, ['/projects', '/tasks', '/timesheets'], `${name}: Tools shows Work`)
      assert.deepEqual(shared(web.Work!, tools.Work!), shared(tools.Work!, web.Work!), `${name}: what both show sits in the same order`)
      assert.deepEqual(Object.keys(tools), ['Work', 'Payments'], `${name}: Tools' groups in the layout's order`)

      // Yusuf hides Timesheet in Web, at once: Web drops it, Tools keeps it.
      settled(await hide({ circle: 'web', feature: 'timesheet', hidden: true }, as(yusuf)))
      assert.deepEqual((await drawn(page, dev.base, 'web')).Work, ['/projects', '/tasks', '/contacts'], `${name}: Web no longer shows Timesheet`)
      assert.deepEqual((await drawn(page, dev.base, 'tools')).Work, ['/projects', '/tasks', '/timesheets'], `${name}: Tools still does`)

      // Work renamed Studio in the layout: each circle still shows it.
      await laid(layout.replace('Work:', 'Studio:'))
      const renamed = { web: await drawn(page, dev.base, 'web'), tools: await drawn(page, dev.base, 'tools') }
      assert.deepEqual(renamed.web, { Studio: ['/projects', '/tasks', '/contacts'] }, `${name}: Web shows Studio, still without Timesheet`)
      assert.deepEqual(Object.keys(renamed.tools), ['Studio', 'Payments'], `${name}: Tools shows Studio where it showed Work`)
      assert.deepEqual(renamed.tools.Studio, ['/projects', '/tasks', '/timesheets'])
      assert.deepEqual(errors, [], `${name}: the pages threw nothing`)

      // Put back for the next browser.
      await laid(layout)
      settled(await hide({ circle: 'web', feature: 'timesheet', hidden: false }, as(yusuf)))
      assert.equal((await one<{ f: string }>(`SELECT circle.features('ag') AS f`)).f, layout)
    } finally {
      await context.close()
      await dev.stop()
      await browser.close()
    }
  })
})
