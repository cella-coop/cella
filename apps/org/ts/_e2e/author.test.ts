// A motion's author is a grantee, end to end on a seeded Lanterne:
// Camille, who holds the manager role by a tenure, proposes to the
// assembly as the manager; Julien proposes as the assembly, naming no
// one; and Julien proposing as the manager, which he does not hold, or
// as coordination, another circle, is refused, the reason naming the
// role or the circle and never him. Run by `cella test e2e author`.
// covers: membership-motion motion

import { test as runTest } from 'node:test'
import { createStory } from './story.ts'
export const { before, after, test, unseeded, story } = createStory()
import { mkdirSync } from 'node:fs'
import assert from 'node:assert/strict'
import pg from 'pg'
import { motion as read, summaries, authors } from '@cella/org-motion/api'
import { propose } from '@cella/org-graft-membership-motion/api'
import type { Propose } from '@cella/org-motion/models'
import type { Deps } from '@cella/org-db'
import { reader, sign } from './lanterne.ts'
import { inBrowsers, serve, signIn } from './browser.ts'

const su = new pg.Client()
let app: pg.Client

const at = (name: string) => `${name}@lanterne.example`
const camille = at('camille')
const julien = at('julien')
const shots = process.env.SHOTS ?? '/tmp/cella-author-shots'

const as = (actor: string): Deps => ({ db: reader(app, actor), actor, sign: sign(actor) })
const proposal = (title: string, author?: string): Propose => ({
  circle: 'ag',
  title,
  deadline: '2026-11-07',
  body: '',
  actions: [],
  ...(author ? { author } : {}),
})
const settled = <T>(out: { state: string; value?: T; reason?: string }): T => {
  assert.equal(out.state, 'settled', out.reason)
  return out.value as T
}
const authorOf = async (motion: string) =>
  (await su.query<{ author: string }>('SELECT author FROM motion.motion WHERE id = $1', [motion])).rows[0]?.author

before(async () => {
  await su.connect()
  await su.query(`ALTER ROLE cella_app IN DATABASE ${su.escapeIdentifier(su.database ?? '')} SET cella.clock = '2026-10-24'`)
  app = new pg.Client({ user: 'cella_app' })
  await app.connect()
})

after(async () => {
  await app.end()
  await su.end()
})

test('Camille proposes to the assembly as the manager, a role she holds that day', async () => {
  const { motion, author } = settled(await propose(proposal('The manager asks the assembly', 'manager'), as(camille)))
  assert.equal(author, 'manager')
  assert.equal(await authorOf(motion), 'manager')
  const page = await read(as(camille).db, motion)
  assert.equal(page?.author, 'manager')
  assert.equal(page?.authorName, 'Manager')
  assert.ok((await authors(as(camille).db, camille)).some((a) => a.value === 'manager' && a.label === 'Manager'))
  assert.ok(!(await authors(as(julien).db, julien)).some((a) => a.value === 'manager'))
  assert.equal((await summaries(as(camille).db)).find((s) => s.id === motion)?.authorName, 'Manager')
  const logged = await su.query<{ author: string }>(`SELECT form ->> 'author' AS author FROM cella.log WHERE op = 'motion:motion:propose' ORDER BY n DESC LIMIT 1`)
  assert.equal(logged.rows[0]?.author, 'manager')
})

test('a proposal naming no author is the circle\'s', async () => {
  const { motion, author } = settled(await propose(proposal('The assembly asks itself'), as(julien)))
  assert.equal(author, 'ag')
  assert.equal(await authorOf(motion), 'ag')
  assert.equal((await read(as(julien).db, motion))?.authorName, 'General assembly')
  assert.equal((await summaries(as(julien).db)).find((s) => s.id === motion)?.authorName, 'General assembly')
})

unseeded('the New form puts a motion as a held role or as its circle, and the page names that author in light and dark', async () => {
  mkdirSync(shots, { recursive: true })
  await inBrowsers(async (engine, launch) => {
    const browser = await launch()
    const dev = await serve()
    try {
      for (const [who, author, name] of [
        [camille, 'manager', 'Manager'],
        [julien, '', 'General assembly'],
      ]) {
        for (const scheme of ['light', 'dark'] as const) {
          const context = await browser.newContext({ colorScheme: scheme, extraHTTPHeaders: { 'x-forwarded-proto': 'http' } })
          try {
            await signIn(context, dev.base, who)
            const page = await context.newPage()
            await page.goto(`${dev.base}/motions`)
            // A click before the page hydrates opens nothing, as on a box
            // whose cores run other scenarios at once.
            await page.waitForLoadState('networkidle')
            await page.getByRole('button', { name: 'New' }).click()
            const form = page.locator('form').filter({ has: page.getByRole('button', { name: 'Propose' }) })
            await form.locator('select[name^="f.circle["]').selectOption('ag')
            const putBy = form.locator('select[name^="f.author["]')
            assert.equal(await putBy.inputValue(), '', 'the circle is the default')
            if (author) await putBy.selectOption(author)
            assert.equal(await putBy.locator('option:checked').textContent(), author ? name : 'The circle')
            const title = `Author from form ${engine} ${author || 'circle'} ${scheme}`
            await form.getByLabel('Title').fill(title)
            await form.getByLabel('Deadline').fill('07/11/2026')
            assert.equal(await form.locator('[name^="f.deadline["]').inputValue(), '2026-11-07', 'the date posts as ISO')
            assert.equal(await form.evaluate((el) => (el as HTMLFormElement).checkValidity()), true, 'the form is valid')
            await form.screenshot({ path: `${shots}/${engine}-${author || 'circle'}-${scheme}-form.png` })
            await form.getByRole('button', { name: 'Propose' }).click()
            await page.getByText(title, { exact: true }).waitFor({ timeout: 10000 })
            // The row comes back with the write; the shell's counts are read
            // after it, and the outcome shows once they are, so the page is
            // left only then.
            await page.getByRole('status').filter({ hasText: /Settled/ }).waitFor()
            const made = (await summaries(as(who).db)).find((m) => m.title === title)
            assert.ok(made, `${engine} ${scheme}: the form proposed a motion: ${await page.locator('body').innerText()}`)
            assert.equal(made.author, author || 'ag')
            assert.equal(made.authorName, name)
            await page.goto(`${dev.base}/motions/${made.id}`)
            await page.waitForLoadState('networkidle')
            assert.ok(await page.getByText(name, { exact: true }).count() > 0, 'the page names its author')
            await page.screenshot({ path: `${shots}/${engine}-${author || 'circle'}-${scheme}-page.png`, fullPage: true })
          } finally {
            await context.close()
          }
        }
      }
    } finally {
      await browser.close()
      await dev.stop()
    }
  })
})

test('Julien may propose as neither the manager, which he does not hold, nor coordination', async () => {
  const unheld = await propose(proposal('Not his to ask', 'manager'), as(julien))
  assert.equal(unheld.state, 'refused')
  assert.match(
    unheld.state === 'refused' ? unheld.reason : '',
    /the manager role is held by no tenure of the proposer's on 2026-10-24: propose as ag, or as a role held that day/,
  )
  const other = await propose(proposal('Not a circle\'s to ask here', 'coordination'), as(julien))
  assert.equal(other.state, 'refused')
  const reason = other.state === 'refused' ? other.reason : ''
  assert.match(reason, /a motion of ag is proposed as ag or as a role its proposer holds, not as coordination, another circle/)
  assert.doesNotMatch(reason, /julien/)
})

if (!process.env.CELLA_STORY) runTest('author story', async (t) => story((name, step) => t.test(name, step)))
