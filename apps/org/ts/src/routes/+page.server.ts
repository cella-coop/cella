import { values } from '@cella/org-db'
import { fields, pins as check, type Field } from '@cella/org-ui/models'
import { using } from '#lib/server/db.ts'
import { run } from '#lib/server/reads.ts'
import { mounted, source } from '#lib/server/slices.ts'
import { collection, columns, home } from '#lib/slices.ts'
import type { PageServerLoad } from './$types'

// The co-op's home: the widgets pinned from many collections, the
// viewer's own from the address (`w`) or else the co-op's, each checked
// against its collection's fields and run in SQL over that collection's
// rows as the acting member sees them; and, for the collection being
// edited (`c`), its enumerations' values.
export const load: PageServerLoad = async ({ url, locals }) => {
  const known = (name: string): Field[] | undefined => (mounted(name) && collection(name) ? fields(columns(name)) : undefined)
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
    for (const p of checked.pins) {
      const from = source(p.collection)
      const [r] = from ? await run(db, from, [p], [], known(p.collection) ?? []) : []
      if (r) {
        results.push({ ...r, from: { label: collection(p.collection)?.view.title ?? p.collection, href: `/${p.collection}` } })
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
    return { pins: checked.pins, custom: asked !== null, errors: [...errors, ...checked.errors], results, editing, values: held }
  })
}
