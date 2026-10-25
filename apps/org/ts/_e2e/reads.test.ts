// The reads scenario: a collection read in SQL, a page at a time. The
// composer over rows of its own; every collection's read composed and run
// on a seeded Lanterne, each badge and date column's key holding what it
// shows; and the built shell paging fifty thousand time entries, its text
// filter, its counts and the viewer's own views' tallies, outside dev
// mode. Run by `cella test e2e reads`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { register } from 'node:module'
import pg from 'pg'
import { counts, measures, page, read, today, values, type Source } from '@cella/org-db'
import { fields } from '@cella/org-ui/models'
import { slices, source } from '#lib/server/slices.ts'
import { Shell } from './serve.ts'

// The client sides' columns, with their components stubbed: what the
// columns show is plain code, which runs here as in the browser.
const stub = `
const names = ['goto', 'refreshAll', 'invalidate', 'invalidateAll', 'applyAction', 'enhance', 'deserialize', 'page', 'navigating', 'updated']
export async function resolve(spec, ctx, next) {
  if (spec.endsWith('.svelte') || spec.endsWith('.css') || spec.startsWith('$app/') || spec.startsWith('phosphor-svelte/')) {
    return { url: 'data:text/javascript,' + encodeURIComponent('export default {};' + names.map((n) => 'export const ' + n + ' = () => {};').join('')), shortCircuit: true }
  }
  return next(spec, ctx)
}`
register(`data:text/javascript,${encodeURIComponent(stub)}`)
const { columns } = await import('#lib/slices.ts')

const su = new pg.Client()
const shell = new Shell(su)
let app: pg.Client

const hugo = 'hugo@lanterne.example'
const julien = 'julien@lanterne.example'
const camille = 'camille@lanterne.example'

// Reads as `actor` on the app's role.
const as = async (actor: string) => {
  await app.query(`SELECT set_config('cella.actor', $1, false)`, [actor])
  return app
}

before(async () => {
  await su.connect()
  await shell.start('2026-10-24')
  app = new pg.Client({ user: 'cella_app' })
  await app.connect()
})

after(async () => {
  await app.end()
  await shell.stop()
  await su.end()
})

// Three invoices of their own, and a client for two of them.
const invoices: Source = {
  rows: [
    {
      sql: `SELECT * FROM (VALUES ('a', 'unpaid', '2026-08-02', 1000, 1000), ('b', 'overdue', '2026-10-01', 500, 300), ('c', 'paid', '2026-10-20', 200, 0))
              v(id, state, issued, total, owed)`,
      order: 'issued DESC',
    },
  ],
  fields: [`SELECT * FROM (VALUES ('a', 'Nuvola Énergie'), ('c', 'Les Halles')) v(id, client)`],
}

test('the composer reads the rows it keeps in the order they list in, a page of them, with each extension\'s fields', async () => {
  const db = await as(hugo)
  assert.deepEqual(
    (await page(db, invoices, { where: [] })).map((r) => r.id),
    ['c', 'b', 'a'],
  )
  assert.deepEqual(await page(db, invoices, { where: [] }, 1, 1), [{ id: 'b', state: 'overdue', issued: '2026-10-01', total: 500, owed: 300 }], 'an invoice with no client has no client field')
  assert.deepEqual((await page(db, invoices, { where: [{ field: 'state', is: ['unpaid', 'overdue'] }] })).map((r) => r.id), ['b', 'a'])
  assert.deepEqual((await page(db, invoices, { where: [], q: { text: 'nUvO', keys: ['client', 'state'] } })).map((r) => r.id), ['a'], 'the filter holds in any case')
  assert.deepEqual(await page(db, invoices, { where: [], q: { text: 'nuvo', keys: ['state'] } }), [], 'only in the keys it names')
})

test('the composer counts, gives each enumeration\'s values, and runs the widgets as aggregates, the month the scope\'s', async () => {
  const db = await as(hugo)
  assert.equal(await today(db), '2026-10-24', 'today is the verdict date')
  assert.deepEqual(
    await counts(db, invoices, [{ where: [] }, { where: [{ field: 'issued', within: 'month' }] }, { where: [{ field: 'issued', within: 'year' }] }, { where: [{ field: 'client', is: [''] }] }]),
    [3, 2, 3, 1],
    'a field the row has not is the empty value',
  )
  assert.deepEqual(await values(db, invoices, ['state', 'client']), { state: ['overdue', 'paid', 'unpaid'], client: ['Les Halles', 'Nuvola Énergie'] })
  assert.deepEqual(
    await read(db, invoices, { keep: { where: [{ field: 'state', is: ['paid'] }] }, counts: [{ where: [] }], values: ['state', 'nothing'] }),
    { rows: [{ id: 'c', state: 'paid', issued: '2026-10-20', total: 200, owed: 0, client: 'Les Halles' }], counts: [3], values: { state: ['overdue', 'paid', 'unpaid'], nothing: [] } },
    'a page\'s rows, counts and values in one statement',
  )
  const [owed, month, average, byMonth, byClient] = await measures(db, invoices, [
    { where: [{ field: 'state', is: ['unpaid', 'overdue'] }], op: 'sum', field: 'owed' },
    { where: [{ field: 'issued', within: 'month' }], op: 'count' },
    { where: [{ field: 'state', is: ['voided'] }], op: 'avg', field: 'total' },
    { where: [], op: 'sum', field: 'total', by: { field: 'issued', month: true } },
    { where: [], op: 'count', by: { field: 'client', month: false } },
  ])
  assert.equal(owed, 1300)
  assert.equal(month, 2)
  assert.equal(average, null, 'nothing to average over is no figure')
  assert.deepEqual(byMonth, [
    { label: '2026-08', value: 1000 },
    { label: '2026-10', value: 700 },
  ])
  assert.deepEqual(byClient, [
    { label: '—', value: 1 },
    { label: 'Les Halles', value: 1 },
    { label: 'Nuvola Énergie', value: 1 },
  ], 'a row without the field falls under "—"')
})

const collections = slices.flatMap((s) => Object.keys(s.collections ?? {}))

test('every collection reads in one statement, as a worker and as finance', async () => {
  for (const actor of [camille, julien]) {
    const db = await as(actor)
    for (const name of collections) {
      const from = source(name) as Source
      const fs = fields(columns(name))
      const rows = await page(db, from, { where: [], q: { text: 'a', keys: fs.map((f) => f.key) } }, 5)
      assert.ok(rows.every((r) => typeof r.id === 'string'), `${name}'s rows each have an id, as text`)
      await counts(db, from, [{ where: [] }])
      await values(
        db,
        from,
        fs.filter((f) => f.type === 'enum').map((f) => f.key),
      )
    }
  }
})

test('each badge and date column\'s key holds what the column shows, as conditions, boards and widgets read it', async () => {
  const db = await as(julien)
  let checked = 0
  for (const name of collections) {
    const shown = columns(name).filter((c) => c.kind === 'badge' || c.kind === 'date')
    for (const row of await page(db, source(name) as Source, { where: [] })) {
      for (const c of shown) {
        const held = (row as Record<string, unknown>)[c.key]
        assert.equal(String(held ?? ''), String(c.value(row) ?? ''), `${name} ${row.id}: ${c.key}`)
        checked++
      }
    }
  }
  assert.ok(checked > 1000, `${checked} values checked`)
})

test('a page of fifty thousand time entries is read in SQL: a hundred rows drawn, more in the address, the filter and the counts on the server', async () => {
  // Fifty thousand entries of Camille's in October, a day's quarter hours.
  await su.query(
    `INSERT INTO timesheet.entry (member, day, minutes, billable, note)
     SELECT $1, date '2026-10-01' + (i % 23), 15, i % 3 <> 0, 'load ' || i FROM generate_series(1, 50000) i`,
    [camille],
  )
  const rows = (html: string) => (html.match(/<tr\b/g) ?? []).length - 1
  const started = performance.now()
  const first = await shell.page('/timesheets', julien)
  const took = performance.now() - started
  assert.equal(first.status, 200)
  assert.equal(rows(first.text), 100, 'the table draws a hundred rows')
  assert.match(first.text, /Show 100 more/)
  const all = Number(first.text.match(/title="View All timesheets (\d+)"/)?.[1])
  assert.ok(all >= 50838, `the All tab counts every entry: ${all}`)
  assert.ok(first.text.length < 2_000_000, `the page carries a page of rows, not fifty thousand: ${first.text.length} bytes`)
  console.log(`# /timesheets over ${all} entries: ${Math.round(took)} ms, ${first.text.length} bytes`)

  const more = await shell.page('/timesheets?n=250', julien)
  assert.equal(rows(more.text), 250, 'the address asks for more')

  const filtered = await shell.page('/timesheets?q=load%2049999', julien)
  assert.equal(rows(filtered.text), 1, 'the text filter keeps the one entry in SQL')
  assert.match(filtered.text, /1 of \d+ · “load 49999”/)

  const unbillable = encodeURIComponent(JSON.stringify([[{ field: 'billable', is: ['internal'] }], [{ field: 'nothing', is: ['x'] }]]))
  const tallies = (await shell.json(`/timesheets?where=${unbillable}`, julien)) as (number | null)[]
  assert.ok(typeof tallies[0] === 'number' && tallies[0] >= 16666, `a viewer's own view is counted on the server: ${tallies[0]}`)
  assert.equal(tallies[1], null, 'a view naming no field of the collection counts nothing')
})
