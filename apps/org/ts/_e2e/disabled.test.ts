// The writes a member lacks the power for, drawn unavailable before they
// are made, in every browser, on a seeded Lanterne through the dev
// server: on Sofia's submitted print proofs, ex-0001, a record of Brand's,
// Chloé, who holds no mandate for approve-expense, sees Approve and
// Refuse unavailable but focusable, each with the reason circle-person's
// guard would give, naming the roles that hold it and the motion's
// circle, as its tooltip, and pressing Approve writes nothing; Hugo,
// Brand's lead, who holds it, sees both available. The reason is the
// guard's own function's (`circle_person.refused`), asked before the
// write. `SHOTS` names where its screenshots go. It writes nothing to the
// log. Run by `cella test e2e disabled`.
// covers: expense expense-transaction

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import pg from 'pg'
import type { BrowserContext, Page } from 'playwright-core'
import { eachBrowser, serve, signIn } from './browser.ts'

const su = new pg.Client()

const shots = process.env.SHOTS ?? '/tmp/cella-disabled-shots'
const chloe = 'chloe@lanterne.example'
const hugo = 'hugo@lanterne.example'
const expense = 'ex-0001'

const one = async <R>(sql: string, values: unknown[] = []) => (await su.query(sql, values)).rows[0] as R

// What the guard on every write with a power would answer the actor for
// a power over the expense's circle on the verdict date, with no amount.
const refusal = async (actor: string, power: string) =>
  (
    await one<{ why: string | null }>(
      `SELECT circle_person.refused($1, $2, NULL, e.circle, cella.verdict_date()) AS why FROM expense.expense e WHERE e.id = $3`,
      [actor, power, expense],
    )
  ).why

// The expense's page as the actor sees it, its writes drawn.
async function opened(context: BrowserContext, base: string, actor: string): Promise<Page> {
  await signIn(context, base, actor)
  const page = await context.newPage()
  await page.goto(`${base}/expenses/${expense}`)
  await page.waitForLoadState('networkidle')
  await page.locator('form[data-write="approve"] button').waitFor()
  return page
}

const button = (page: Page, write: string) => page.locator(`form[data-write="${write}"] button[type="submit"]`)

before(async () => {
  await su.connect()
})

after(async () => {
  await su.end()
})

eachBrowser((engine, launch) => {
  test(`${engine}: Chloé sees Approve unavailable, saying which mandate would allow it; Hugo, who holds it, sees it available`, async () => {
    mkdirSync(shots, { recursive: true })
    assert.equal((await one<{ status: string }>('SELECT status FROM expense.expense WHERE id = $1', [expense])).status, 'submitted')
    const why = await refusal(chloe, 'approve-expense')
    assert.ok(why, 'Chloé holds no mandate for approve-expense')
    assert.match(why, /^the actor holds no mandate for approve-expense over brand's records: it is held by .*lead in brand .*would allow it$/)
    assert.equal(await refusal(hugo, 'approve-expense'), null, 'Hugo holds it')
    const browser = await launch()
    const dev = await serve()
    const contexts: BrowserContext[] = []
    const context = async () => {
      const c = await browser.newContext({ viewport: { width: 1280, height: 900 }, extraHTTPHeaders: { 'x-forwarded-proto': 'http' } })
      contexts.push(c)
      return c
    }
    try {
      // Chloé: both writes drawn, unavailable and focusable, each saying
      // why as its tooltip and its description.
      const page = await opened(await context(), dev.base, chloe)
      const errors: string[] = []
      page.on('pageerror', (e) => errors.push(`${page.url()}: ${e.message}`))
      for (const write of ['approve', 'refuse']) {
        const b = button(page, write)
        assert.equal(await b.getAttribute('aria-disabled'), 'true', `${engine}: ${write} reads as unavailable`)
        assert.equal(await b.evaluate((el) => (el as HTMLButtonElement).disabled), false, `${engine}: ${write} is not disabled, so the keyboard reaches it`)
        const described = await b.getAttribute('aria-describedby')
        assert.ok(described, `${engine}: ${write} is described by its reason`)
        assert.equal((await page.locator(`[id="${described}"]`).textContent())?.trim(), why, `${engine}: ${write}'s reason is the guard's`)
      }
      const approve = button(page, 'approve')
      await approve.focus()
      const tip = page.locator(`[id="${await approve.getAttribute('aria-describedby')}"]`)
      await page.waitForFunction((id) => document.getElementById(id!)?.matches(':popover-open'), await approve.getAttribute('aria-describedby'))
      assert.equal(await tip.getAttribute('role'), 'tooltip')
      await page.screenshot({ path: `${shots}/disabled-chloe-${engine}.png` })

      // Pressed, by the pointer and by the keyboard, it writes nothing.
      const before = (await one<{ n: number }>('SELECT count(*)::int AS n FROM cella.log')).n
      // Playwright waits for a button aria-disabled to be enabled; a person
      // presses it all the same.
      await approve.click({ force: true })
      await approve.press('Enter')
      await page.waitForTimeout(500)
      assert.equal((await one<{ n: number }>('SELECT count(*)::int AS n FROM cella.log')).n, before, `${engine}: a refused press writes nothing`)
      assert.equal((await one<{ status: string }>('SELECT status FROM expense.expense WHERE id = $1', [expense])).status, 'submitted')
      assert.deepEqual(errors, [], `${engine}: the page threw nothing`)

      // Hugo: both available, with nothing to say.
      const his = await opened(await context(), dev.base, hugo)
      for (const write of ['approve', 'refuse']) {
        const b = button(his, write)
        assert.equal(await b.getAttribute('aria-disabled'), 'false', `${engine}: ${write} is Hugo's to press`)
        assert.equal(await b.getAttribute('aria-describedby'), null, `${engine}: ${write} has no reason against it`)
      }
      await his.screenshot({ path: `${shots}/disabled-hugo-${engine}.png` })
    } finally {
      for (const c of contexts) {
        await c.close()
      }
      await dev.stop()
      await browser.close()
    }
  })
})
