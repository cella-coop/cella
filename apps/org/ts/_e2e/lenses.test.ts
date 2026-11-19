// The lenses scenario: Lanterne, seeded, as the shell reads it, holds what
// the fixture check's richness rule reads of its files
// (tools/fixture/rich.mjs). Each board groups by the lanes the rule
// reads, and every lane it finds held shows in the app; every circle's
// lens shows rows of each collection a circle's work fills, a slice of
// its own, and each collection whose rows spread over the circles shows
// rows under more than one lens. Read as Camille, the manager, whose
// mandates on the whole coop read every circle's records. Run by
// `cella test e2e lenses`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { register } from 'node:module'
import pg from 'pg'
import { parse } from 'smol-toml'
import { page, values, type Source } from '@cella/org-db'
import { slices, source } from '#lib/server/slices.ts'

// The client sides' views, with their components stubbed: what a view
// declares is plain code, which runs here as in the browser.
const stub = `
const names = ['goto', 'refreshAll', 'invalidate', 'invalidateAll', 'applyAction', 'enhance', 'deserialize', 'page', 'navigating', 'updated']
export async function resolve(spec, ctx, next) {
  if (spec.endsWith('.svelte') || spec.endsWith('.css') || spec.startsWith('$app/') || spec.startsWith('phosphor-svelte/')) {
    return { url: 'data:text/javascript,' + encodeURIComponent('export default {};' + names.map((n) => 'export const ' + n + ' = () => {};').join('')), shortCircuit: true }
  }
  return next(spec, ctx)
}`
register(`data:text/javascript,${encodeURIComponent(stub)}`)
const { look } = await import('#lib/slices.ts')
const { declared, listing } = await import(new URL('../../../../tools/fixture/rich.mjs', import.meta.url).href)

const dir = new URL('../../fixtures/lanterne/', import.meta.url)
const read = (file: string) => {
  try {
    return parse(readFileSync(new URL(`${file}.toml`, dir), 'utf8')) as Record<string, any>
  } catch {
    return {}
  }
}
const listed = listing(read) as Record<string, { none?: string; every?: boolean; spread?: boolean; empty?: Record<string, Record<string, string>> }>
const circles = ((read('circle').circle ?? []) as { id: string }[]).map((c) => c.id)
const collections = slices.flatMap((s) => Object.keys(s.collections ?? {}))

const app = new pg.Client({ user: 'cella_app' })

before(async () => {
  await app.connect()
  await app.query(`SELECT set_config('cella.actor', $1, false)`, ['camille@lanterne.example'])
})

after(async () => {
  await app.end()
})

// Every row a collection shows under a lens, or with none.
const rows = async (name: string, lens: string | null = null) =>
  (await page(app, source(name, lens) as Source, { where: [] }, 100_000)).map((r) => String(r.id))

test('each board groups by the lanes the fixture check reads, and every lane it finds held shows', async () => {
  for (const name of collections.filter((n) => !listed[n]?.none)) {
    // A board's lanes, and those the fixture check reads; a list's
    // groups take their order from the look's lanes too, which a value
    // may leave empty, as a person's path may hold no candidate.
    const own = look(name)
    const lanes = Object.fromEntries(Object.entries(own.lanes ?? {}).filter(([k]) => own.layout === 'board' || k in (declared[name] ?? {})))
    assert.deepEqual(lanes, declared[name] ?? {}, `${name}'s board groups by the lanes tools/fixture/rich.mjs reads`)
    const held = await values(app, source(name) as Source, Object.keys(lanes))
    for (const [lane, all] of Object.entries(lanes)) {
      for (const v of all) {
        if (!listed[name]?.empty?.[lane]?.[v]) {
          assert.ok(held[lane]?.includes(v), `${name} shows a row ${lane} ${v}`)
        }
      }
    }
  }
})

test('every circle\'s lens shows a slice of its own of each collection its work fills', async () => {
  const slice = new Map<string, Set<string>>()
  for (const name of collections.filter((n) => listed[n]?.every)) {
    for (const circle of circles) {
      const ids = await rows(name, circle)
      assert.ok(ids.length > 0, `${circle}'s lens shows rows of ${name}`)
      const own = slice.get(circle) ?? new Set()
      ids.forEach((id) => own.add(`${name} ${id}`))
      slice.set(circle, own)
    }
  }
  for (const a of circles) {
    for (const b of circles.filter((c) => c > a)) {
      const shared = [...(slice.get(a) ?? [])].filter((x) => slice.get(b)?.has(x))
      assert.deepEqual(shared, [], `${a}'s lens and ${b}'s show no row in common`)
    }
  }
})

test('a collection whose rows spread over the circles shows rows under more than one lens', async () => {
  for (const name of collections.filter((n) => listed[n]?.spread)) {
    const under = []
    for (const circle of circles) {
      if ((await rows(name, circle)).length) {
        under.push(circle)
      }
    }
    assert.ok(under.length > 1, `${name} shows rows under ${under.join(', ') || 'no lens'}`)
  }
})
