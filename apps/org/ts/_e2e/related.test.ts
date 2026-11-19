// A record's page shows at most four tabs, its owner's, and every other
// collection holding rows of it is a jump in the drawer's Related. On the
// built shell, every record page of Lanterne draws four tabs or fewer;
// then in every browser, light and dark, signed in as Julien: a person's
// page draws Overview, Membership, Work and Authority, each opening, and
// no Tasks, Expenses or Records tab; on a person's, a circle's and a
// project's page Related counts each collection whose rows name it, the
// count the scenario reads itself in SQL; following the jump lands on
// that collection filtered to the record, the condition in the address,
// with as many rows in its header's count, or, where a tab of the record
// lists it, as a project's Tasks, on that tab. Nothing is written. Run by
// `cella test e2e related`.
// covers: core membership membership-task employment project project-task project-timesheet

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import type { Page } from 'playwright-core'
import { page as read, type Condition, type Source } from '@cella/org-db'
import { slices, source } from '#lib/server/slices.ts'
import { eachBrowser, serve, signIn } from './browser.ts'
import { Shell } from './serve.ts'

const julien = 'julien@lanterne.example'
const su = new pg.Client()
const shell = new Shell(su)
const app = new pg.Client({ user: 'cella_app' })

before(async () => {
  await su.connect()
  await app.connect()
  await app.query(`SELECT set_config('cella.actor', $1, false)`, [julien])
})

after(async () => {
  await app.end()
  await su.end()
})

const rows = async (name: string, where: Condition[] = []) => (await read(app, source(name) as Source, { where })) as { id: string }[]

// The person with the most open tasks Julien reads, a circle holding
// projects, and the project holding the most tasks.
async function records() {
  const one = async (sql: string) => (await app.query<{ id: string }>(sql)).rows[0]?.id ?? ''
  const person = await one(`SELECT member AS id FROM membership_task.assignment GROUP BY member ORDER BY count(*) DESC, member LIMIT 1`)
  const circle = await one(`SELECT circle AS id FROM project.project GROUP BY circle ORDER BY count(*) DESC, circle LIMIT 1`)
  const project = await one(`SELECT project AS id FROM project_task.filing GROUP BY project ORDER BY count(*) DESC, project LIMIT 1`)
  assert.ok(person && circle && project, 'Lanterne has a person with tasks, a circle with projects and a project with tasks')
  return { person, circle, project }
}

test('every record page of Lanterne draws four tabs or fewer', async () => {
  await shell.start('2026-10-24')
  const owned = slices.flatMap((s) => Object.entries(s.collections ?? {}).filter(([, c]) => c.item).map(([name]) => name))
  const drawn = new Map<string, number>()
  for (const name of owned) {
    const first = (await rows(name))[0]
    if (!first) {
      continue
    }
    const { status, text } = await shell.page(`/${name}/${encodeURIComponent(first.id)}`, julien)
    assert.equal(status, 200, `${name}/${first.id} opens`)
    const nav = text.match(/<nav class="tabs[^"]*"[^>]*>([\s\S]*?)<\/nav>/)?.[1] ?? ''
    const tabs = [...nav.matchAll(/<a\b/g)].length
    assert.ok(tabs <= 4, `${name}/${first.id} draws ${tabs} tabs`)
    drawn.set(name, tabs)
  }
  assert.equal(drawn.get('people'), 4, 'a person\'s page draws its four')
  await shell.stop()
})

eachBrowser((browserName, launch) => {
  test(`${browserName}: a person's four tabs open, and Related's jumps from a person, a circle and a project land filtered, light and dark`, async () => {
    const { person, circle, project } = await records()
    const { base, stop } = await serve()
    const browser = await launch()
    try {
      for (const scheme of ['light', 'dark'] as const) {
        const at = `${browserName}, ${scheme}`
        const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, colorScheme: scheme, extraHTTPHeaders: { 'x-forwarded-proto': 'http' } })
        await signIn(context, base, julien)
        const page = await context.newPage()
        const errors: string[] = []
        page.on('pageerror', (e) => errors.push(`${page.url()}: ${e.message}`))
        const visit = async (path: string) => {
          await page.goto(`${base}${path}`)
          await page.waitForLoadState('networkidle')
        }

        // A person's tabs, each opening on its own.
        const home = `/people/${encodeURIComponent(person)}`
        await visit(home)
        const nav = page.getByRole('navigation', { name: 'Person tabs' })
        assert.deepEqual((await nav.getByRole('link').allTextContents()).map((t) => t.trim()), ['Overview', 'Membership', 'Work', 'Authority'], `${at}: a person's tabs`)
        for (const [label, id] of [['Membership', 'membership'], ['Work', 'work'], ['Authority', 'authority'], ['Overview', '']] as const) {
          await nav.getByRole('link', { name: label, exact: true }).click()
          await page.waitForURL((u) => u.pathname === home && (u.searchParams.get('tab') ?? '') === id)
          await page.waitForLoadState('networkidle')
          assert.equal((await nav.locator('[aria-current="page"]').textContent())?.trim(), label, `${at}: ${label} is the open tab`)
        }

        // Related's jumps: each count is what SQL reads of that collection
        // filtered to the record, and following it lands there, or on the
        // record's tab that lists it scoped to the record (`tab`).
        const jumps = async (path: string, want: string, key: string, id: string, tab?: string) => {
          await visit(path)
          const related = page.locator('section.related')
          const link = related.locator('a.jump', { hasText: want })
          await link.first().waitFor()
          const where = [{ field: key, is: [id] }]
          const count = (await rows(want.toLowerCase(), where)).length
          assert.ok(count > 0, `${at}: ${path} has ${want}`)
          assert.equal((await link.locator('.count').textContent())?.trim(), String(count), `${at}: ${path}'s Related counts its ${want}`)
          await link.click()
          if (tab) {
            await page.waitForURL((u) => u.pathname === path && u.searchParams.get('tab') === tab)
            await page.waitForLoadState('networkidle')
            const tabs = page.locator('nav.tabs')
            await tabs.locator('[aria-current="page"]', { hasText: want }).waitFor()
            assert.equal((await tabs.locator('[aria-current="page"]').textContent())?.trim(), want, `${at}: ${want} opens the record's ${want} tab`)
            return
          }
          await page.waitForURL((u) => u.pathname === `/${want.toLowerCase()}`)
          await page.waitForLoadState('networkidle')
          assert.deepEqual(JSON.parse(new URL(page.url()).searchParams.get('where') ?? '[]'), where, `${at}: ${want} filtered to ${id}`)
          assert.equal((await page.locator('header.top .name .count').textContent())?.trim(), String(count), `${at}: ${want} counts ${count} rows`)
        }
        await jumps(home, 'Tasks', 'assigned', person)
        await jumps(`/circles/${encodeURIComponent(circle)}`, 'Projects', 'circle', circle)
        await jumps(`/projects/${encodeURIComponent(project)}`, 'Tasks', 'project_id', project, 'tasks')
        assert.deepEqual(errors, [], `${at}: no page error`)
        await context.close()
      }
    } finally {
      await browser.close()
      await stop()
    }
  })
})
