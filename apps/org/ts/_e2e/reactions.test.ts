// The reactions scenario, in every browser, on a seeded Lanterne through
// the dev server: Léa reacts 👍 to Amina's comment on the go-live
// checklist, a task of Web's, and takes it back, then gives it again.
// Camille opens Web's rules page, `/settings/rules/web`, from Web's
// Settings tab, turns reactions off and Saves; the dialog offers the
// assembly's motion carrying the rule, every member consents, and on its
// deadline she closes it: Web's comments take no reactions, the thread
// draws none, and a reaction posted through the handler is refused,
// naming the circle and the rule. Camille then turns them on again from
// the same page, a rule replacing the first, and Léa's 👍 is drawn again.
// `SHOTS` names where its screenshots go, light and dark. Run by
// `cella test e2e reactions`.
// covers: motion task

// browsers: one at a time: each browser changes Web's reactions and the scope's clock by the assembly's motions, which the others read

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import pg from 'pg'
import type { BrowserContext, Page } from 'playwright-core'
import { vote } from '@cella/org-motion/api'
import { carried, close } from '@cella/org-graft-membership-motion/api'
import { react } from '@cella/org-task/api'
import type { Deps, Done } from '@cella/org-db'
import { reader, sign } from './lanterne.ts'
import { eachBrowser, serve, signIn } from './browser.ts'

const su = new pg.Client()
let app: pg.Client | undefined

const shots = process.env.SHOTS ?? '/tmp/cella-reactions-shots'
const camille = 'camille@lanterne.example'
const lea = 'lea@lanterne.example'
const amina = 'amina@lanterne.example'
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
// A circle's reactions on the scope's clock, as the app reads them.
const setting = async (circle: string) =>
  ((await (app as pg.Client).query<{ v: string }>(`SELECT circle.setting_of($1, 'reactions') AS v`, [circle])).rows[0].v)

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

// Waits until `ready` holds, or fails saying what never came.
async function until(ready: () => Promise<boolean>, what: string) {
  for (let i = 0; i < 100; i++) {
    if (await ready()) {
      return
    }
    await new Promise((r) => setTimeout(r, 100))
  }
  assert.fail(`${what} never came`)
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
  test(`${name}: Léa reacts to a comment and takes it back; Web's rule turns reactions off and the thread draws none, and another turns them on again`, async () => {
    mkdirSync(shots, { recursive: true })
    const browser = await launch()
    // The dev server reads the scope's clock as its connections opened,
    // so it is served again once a close moves it.
    let dev = await serve()
    const contexts: BrowserContext[] = []
    const errors: string[] = []
    const open = async (actor: string, path: string, scheme: 'light' | 'dark' = 'light') => {
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: scheme, extraHTTPHeaders: { 'x-forwarded-proto': 'http' } })
      contexts.push(context)
      await signIn(context, dev.base, actor)
      const page = await context.newPage()
      page.on('pageerror', (e) => errors.push(`${actor}: ${e.message}`))
      await page.goto(`${dev.base}${path}`)
      await page.waitForLoadState('networkidle')
      return page
    }
    const task = async (scheme: 'light' | 'dark' = 'light') => {
      const page = await open(lea, '/tasks/t-1', scheme)
      await page.waitForSelector('[data-body]:not([data-state=opening])', { timeout: 20_000 })
      return page
    }
    // Camille turns Web's reactions to `value` from its rules page, by the
    // assembly's motion; the motion and its title.
    const rule = async (value: 'on' | 'off') => {
      const page = await open(camille, '/circles/web?tab=settings')
      await page.getByRole('link', { name: 'See its rules' }).click()
      await page.waitForURL(`${dev.base}/settings/rules/web`)
      await page.waitForLoadState('networkidle')
      const form = page.locator('form.settings')
      await form.getByLabel(/Reactions on comments/).selectOption(value)
      await page.screenshot({ path: `${shots}/rules-${value}-${name}.png`, fullPage: true })
      const dialog = page.getByRole('dialog', { name: 'Assembly changes it by motion' })
      await dialog.waitFor()
      assert.ok(
        ((await dialog.textContent()) ?? '').includes("Web's settings change only by a rule a motion of Assembly adopts: no one's own write changes them"),
        `${name}: the dialog says why her write changes nothing`,
      )
      assert.equal(await dialog.getByLabel('Title').inputValue(), `Turn reactions on comments ${value} in Web`, `${name}: its title says the change`)
      assert.equal(await dialog.getByLabel('Circle').inputValue(), 'ag', `${name}: put to the assembly`)
      await dialog.getByRole('button', { name: 'Propose to Assembly' }).click()
      await dialog.waitFor({ state: 'hidden' })
      const { motion } = await one<{ motion: string }>(
        `SELECT motion FROM motion.action WHERE kind = 'policy' AND args ->> 'wording' = $1 AND motion <> ALL ($2::text[]) ORDER BY motion DESC LIMIT 1`,
        [`Assembly sets {setting: reactions} to {value: ${value}} for {circle: web}`, seen],
      )
      seen.push(motion)
      assert.deepEqual(states(await decided(motion)), [['motion:policy:adopt', 'settled', '']], `${name}: its close adopts the rule`)
      await dev.stop()
      dev = await serve()
      return motion
    }
    try {
      const { comment } = await one<{ comment: string }>(`SELECT id AS comment FROM task.comment WHERE task = 't-1' AND author = $1 ORDER BY id LIMIT 1`, [amina])
      const mine = async () => (await one<{ n: string }>(`SELECT count(*) AS n FROM task.reaction WHERE comment = $1 AND person = $2 AND emoji = '👍'`, [comment, lea])).n === '1'
      assert.equal(await mine(), false, `${name}: Léa has given no 👍 yet`)

      // Léa gives 👍, takes it back and gives it again.
      const a = await task()
      const thumb = (page: Page) => page.locator(`[data-comment="${comment}"] [data-reaction="👍"]`)
      assert.equal(await a.locator(`[data-comment="${comment}"] [data-reaction]`).count(), 6, `${name}: the six reactions under Amina's comment`)
      await thumb(a).getByRole('button').click()
      await until(mine, `${name}: Léa's 👍`)
      await a.waitForSelector(`[data-comment="${comment}"] [data-reaction="👍"][data-mine="true"][data-count="1"]`)
      const logged = await all<{ actor: string }>(`SELECT actor FROM cella.log WHERE op = 'task:comment:react' AND (form ->> 'comment') = $1`, [comment])
      assert.ok(logged.some((l) => l.actor === lea), `${name}: the reaction is logged as Léa's`)
      await a.screenshot({ path: `${shots}/reactions-${name}-light.png`, fullPage: true })
      await thumb(a).getByRole('button').click()
      await until(async () => !(await mine()), `${name}: Léa's 👍 taken back`)
      await a.waitForSelector(`[data-comment="${comment}"] [data-reaction="👍"][data-mine="false"][data-count="0"]`)
      await thumb(a).getByRole('button').click()
      await until(mine, `${name}: Léa's 👍 again`)

      // Web's rule turns them off: the thread draws none, and a reaction
      // is refused, naming the circle and the rule.
      const off = await rule('off')
      assert.equal((await setting('web')), 'off', `${name}: Web's reactions are off`)
      assert.equal((await setting('operations')), 'on', `${name}: Operations' are not`)
      const b = await task('dark')
      await b.locator(`[data-comment="${comment}"]`).waitFor()
      assert.equal(await b.locator('[data-reactions]').count(), 0, `${name}: the thread draws no reactions`)
      await b.screenshot({ path: `${shots}/reactions-off-${name}-dark.png`, fullPage: true })
      const refused = await react({ comment: Number(comment), emoji: '🎉', on: true }, as(lea))
      assert.equal(refused.state, 'refused', `${name}: a reaction is refused`)
      assert.equal(reason(refused), `reactions are off in web, by rule ${off}/1: a rule turning them on, adopted by motion, lets a comment take them`)

      // Another turns them on again, replacing it, and Léa's 👍 is drawn.
      await rule('on')
      assert.equal((await setting('web')), 'on', `${name}: Web's reactions are on again`)
      const c = await task()
      await c.waitForSelector(`[data-comment="${comment}"] [data-reaction="👍"][data-mine="true"][data-count="1"]`)
      settled(await react({ comment: Number(comment), emoji: '👍', on: false }, as(lea)))
      assert.deepEqual(errors, [], `${name}: the pages threw nothing`)
    } finally {
      for (const context of contexts) {
        await context.close()
      }
      await browser.close()
      await dev.stop()
    }
  })
})
