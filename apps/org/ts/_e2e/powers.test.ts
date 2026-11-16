// A person's powers, end to end on a seeded Lanterne, through the driver
// and the built shell: for every person and every power, the Powers tab
// lists a line exactly where `circle_person.may` or `circle_person.entitled`
// grants it on the verdict date, each read signed in as the person whose
// page it is. Camille's tab names the manager's tenure,
// 2024 to 2028, and its 20 000 € commit; Hugo's, Brand's lead, the lead's
// approve-expense within 1 000 € a month, its budget unchecked; and
// Inès's, the participant's mandates of Web, Care and Tools, and her rights as a person and an
// employee, read as herself; and a non-member reading another's tab finds
// no right on it. Each mandate's line opens its page. Then, in every browser,
// light and dark, Camille's tab is opened and its commit's line clicked
// through; `SHOTS` names where its screenshots go. Run by `cella test e2e
// powers`.
// covers: membership

import { test as runTest } from 'node:test'
import { createStory } from './story.ts'
export const { before, after, test, unseeded, story } = createStory()
import { mkdirSync } from 'node:fs'
import assert from 'node:assert/strict'
import pg from 'pg'
import { seats } from '@cella/org-membership/api'
import { inBrowsers, serve, signIn } from './browser.ts'
import { reader } from './lanterne.ts'
import { Shell } from './serve.ts'

const su = new pg.Client()
const shell = new Shell(su)
const shots = process.env.SHOTS ?? '/tmp/cella-powers-shots'
const day = '2026-10-24'
let app: pg.Client

const camille = 'camille@lanterne.example'
const hugo = 'hugo@lanterne.example'
const ines = 'ines@lanterne.example'

const all = async <R>(sql: string, values: unknown[] = []) => (await su.query(sql, values)).rows as R[]
// A tab of a person's page, as text, its tags gone, read by whoever is
// signed in, the person themselves unless another is named.
const tab = async (member: string, by = member) => {
  const { status, text } = await shell.page(`/people/${member}?tab=authority`, by)
  assert.equal(status, 200)
  return { html: text, text: text.replace(/<[^>]+>/g, ' ').replace(/&#39;|&rsquo;|’/g, "'").replace(/\s+/g, ' ') }
}
const mandate = async (grantee: string, power: string) =>
  (await all<{ id: string }>(`SELECT id::text FROM circle.mandate WHERE grantee = $1 AND power = $2`, [grantee, power]))[0].id

before(async () => {
  await su.connect()
  await shell.start(day)
  app = new pg.Client({ user: 'cella_app' })
  await app.connect()
})

after(async () => {
  await shell.stop()
  await app.end()
  await su.end()
})

test('for every person and every power, their own tab lists a line exactly where may or entitled grants it', async () => {
  const people = (await all<{ address: string }>('SELECT address FROM person.person ORDER BY address')).map((p) => p.address)
  const powers = (await all<{ power: string }>('SELECT power FROM circle.mandate UNION SELECT power FROM circle.right ORDER BY power')).map((p) => p.power)
  assert.ok(people.length >= 12 && powers.length > 30, `${people.length} people, ${powers.length} powers`)
  let lines = 0
  for (const person of people) {
    const listed = await seats.powers(reader(app, person), person)
    lines += listed.length
    const by = new Set(listed.map((p) => p.power))
    for (const power of powers) {
      const granted = (await all<{ g: boolean }>(
        'SELECT circle_person.may($1, $2, NULL, NULL, $3) OR circle_person.entitled($1, $2, NULL, $3) AS g',
        [person, power, day],
      ))[0].g
      assert.equal(by.has(power), granted, `${person} ${power}`)
    }
  }
  assert.ok(lines > 0)
})

test('Camille holds the commit as manager, by her tenure from 2024 to 2028, up to 20 000 € a write', async () => {
  const listed = await seats.powers(reader(app, camille), camille)
  const commit = listed.filter((p) => p.power === 'commit')
  assert.deepEqual(commit.map((p) => [p.role, p.circle, p.since, p.until, p.limit, p.scope]), [['manager', 'ag', '2024-06-20', '2028-06-20', 2_000_000, null]])
  const { html, text } = await tab(camille)
  for (const says of ['Powers', 'Commit', 'Manager in Assembly', '20 Jun 2024 – 20 Jun 2028', 'the whole co-op', 'seat in Coordination', "every member's right"]) {
    assert.ok(text.includes(says), `Camille's tab says ${says}`)
  }
  assert.ok(html.includes(`href="/mandates/${await mandate('manager', 'commit')}"`), 'the commit\'s line opens its mandate')
})

test('Hugo, Brand\'s lead, approves expenses within 1 000 € a month, its budget shown and said unchecked, and runs Brand\'s projects alone', async () => {
  const listed = await seats.powers(reader(app, hugo), hugo)
  const expense = listed.filter((p) => p.power === 'approve-expense' && p.role === 'lead')
  assert.deepEqual(expense.map((p) => [p.circle, p.budget, p.per, p.limit]), [['brand', 100_000, 'month', null]])
  const projects = listed.filter((p) => p.power === 'manage-project')
  assert.deepEqual(projects.map((p) => [p.role, p.circle, p.scope]), [['lead', 'brand', 'own']])
  const { text } = await tab(hugo)
  for (const says of ['Approve expense', 'Circle lead in Brand', 'a month, unchecked', 'Brand, its own']) {
    assert.ok(text.includes(says), `Hugo's tab says ${says}`)
  }
})

test('Inès, no member, holds the participant mandates of Web, Care and Tools by her seats there, and a person\'s and an employee\'s rights', async () => {
  const listed = await seats.powers(reader(app, ines), ines)
  const seated = listed.filter((p) => p.mandate !== null)
  assert.ok(seated.length > 0 && seated.every((p) => ['web', 'care', 'tools'].includes(p.circle ?? '') && p.tenure === null), 'every mandate of hers is by a seat with no role, in Web, Care or Tools')
  assert.deepEqual([...new Set(seated.map((p) => p.circle))].sort(), ['care', 'tools', 'web'])
  assert.deepEqual([...new Set(listed.map((p) => p.right).filter((r) => r !== null))].sort(), ['employee', 'person'])
  assert.ok(listed.some((p) => p.power === 'log-time' && p.right === 'employee'))
  const { text } = await tab(ines)
  for (const says of ['Propose', 'seat in Web', 'Log time', "every employee's right", "every person's right", 'their own', 'Web, its own', 'Assembly']) {
    assert.ok(text.includes(says), `Inès's tab says ${says}`)
  }
  assert.ok(!text.includes("every member's right"), 'she holds no member\'s right')
})

test('Inès, no member, reading Camille\'s tab finds no right on it', async () => {
  const listed = await seats.powers(reader(app, ines), camille)
  assert.deepEqual(listed.filter((p) => p.right !== null), [], 'the driver gives her none of Camille\'s rights')
  const { text } = await tab(camille, ines)
  for (const says of ["every person's right", "every member's right", "every employee's right"]) {
    assert.ok(!text.includes(says), `the tab says no ${says}`)
  }
})

unseeded('in every browser, light and dark, Camille\'s Powers tab opens and its commit\'s line leads to the mandate\'s chain', async () => {
  const commit = await mandate('manager', 'commit')
  await shell.stop()
  mkdirSync(shots, { recursive: true })
  await inBrowsers(async (engine, launch) => {
    const browser = await launch()
    const dev = await serve()
    try {
      for (const scheme of ['light', 'dark'] as const) {
        const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, colorScheme: scheme, extraHTTPHeaders: { 'x-forwarded-proto': 'http' } })
        await signIn(context, dev.base, camille)
        const page = await context.newPage()
        const errors: string[] = []
        page.on('pageerror', (e) => errors.push(e.message))
        for (const [who, name] of [[camille, 'camille'], [hugo, 'hugo'], [ines, 'ines']]) {
          await page.goto(`${dev.base}/people/${encodeURIComponent(who)}?tab=authority`)
          await page.waitForLoadState('networkidle')
          // Powers, its count after it, not Powers held, which shares the tab.
          const section = page.locator('section', { has: page.getByRole('heading', { name: /^Powers\s*\d*$/ }) })
          assert.match((await section.textContent()) ?? '', /every person's right/, `${engine}, ${scheme}: ${name}'s tab lists their rights`)
          await page.screenshot({ path: `${shots}/powers-${name}-${engine}-${scheme}.png`, fullPage: true })
        }
        await page.goto(`${dev.base}/people/${encodeURIComponent(camille)}?tab=authority`)
        await page.waitForLoadState('networkidle')
        const line = page.locator(`a[href="/mandates/${commit}"]`).first()
        await line.scrollIntoViewIfNeeded()
        await Promise.all([page.waitForURL(`${dev.base}/mandates/${commit}`), line.click()])
        await page.waitForLoadState('networkidle')
        const chain = page.locator('section', { has: page.getByRole('heading', { name: 'Chain' }) })
        assert.match((await chain.textContent()) ?? '', /this one/, `${engine}, ${scheme}: the commit's page draws its chain`)
        assert.deepEqual(errors, [], 'the page threw nothing')
        await context.close()
      }
    } finally {
      await browser.close()
      await dev.stop()
    }
  })
})

if (!process.env.CELLA_STORY) runTest('powers story', async (t) => story((name, step) => t.test(name, step)))
