import { values } from '@cella/org-db'
import { fields, pins as check, type Field } from '@cella/org-ui/models'
import { using } from '#lib/server/db.ts'
import { run, tally } from '#lib/server/reads.ts'
import { port } from '#lib/server/analytics.ts'
import { rows as reported } from '@cella/org-report/api'
import { mounted, source } from '#lib/server/slices.ts'
import { collection, columns, home, pinnable } from '#lib/slices.ts'
import type { PageServerLoad } from './$types'

// The co-op's home: the widgets pinned from many collections, the
// viewer's own from the address (`w`) or else the co-op's, each checked
// against its collection's fields and run in SQL over that collection's
// rows as the acting member sees them, or over a report's rows, which the
// report feat reads through the analytics port; and, for the collection
// being edited (`c`), its enumerations' values.
export const load: PageServerLoad = async ({ url, locals }) => {
  const report = (name: string) => pinnable.find((p) => p.name === name)
  const known = (name: string): Field[] | undefined =>
    mounted(name) && collection(name) ? fields(columns(name)) : report(name) ? fields(report(name)?.columns ?? []) : undefined
  const asked = url.searchParams.get('w')
  let given: unknown = home
  const errors: string[] = []
  if (asked) {
    try {
      given = JSON.parse(asked)
    } catch {
      errors.push('the home in the address is not JSON')
      given = []
    }
  }
  const checked = check(given, known)
  const editing = known(url.searchParams.get('c') ?? '') ? (url.searchParams.get('c') as string) : (checked.pins[0]?.collection ?? 'invoices')
  return using(locals.actor, async (db) => {
    const results = []
    // A report's rows are read once for all its pins; a shell that does
    // not answer leaves its pins out, said.
    const read = new Map<string, Promise<Record<string, unknown>[] | null>>()
    for (const p of checked.pins) {
      const r = report(p.collection)
      if (r) {
        const id = p.collection.slice('reports/'.length)
        read.set(id, read.get(id) ?? reported(port, id))
        try {
          const rows = await read.get(id)
          results.push({ ...tally(rows ?? [], p, known(p.collection) ?? []), from: { label: r.title, href: `/reports/${id}` } })
        } catch (e) {
          errors.push(`${p.title}: ${(e as Error).message}`)
        }
        continue
      }
      const from = source(p.collection)
      const [x] = from ? await run(db, from, [p], [], known(p.collection) ?? []) : []
      if (x) {
        results.push({ ...x, from: { label: collection(p.collection)?.view.title ?? p.collection, href: `/${p.collection}` } })
      }
    }
    const fs = known(editing) ?? []
    const from = source(editing)
    const held = from
      ? await values(
          db,
          from,
          fs.filter((f) => f.type === 'enum').map((f) => f.key),
        )
      : {}
    return { pins: checked.pins, custom: asked !== null, errors: [...checked.errors, ...errors], results, editing, values: held }
  })
}
