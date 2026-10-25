import { aggregate, fields, pins as check, type Field } from '@cella/org-ui/models'
import { using } from '#lib/server/db.ts'
import { mounted, rows } from '#lib/server/slices.ts'
import { collection, columns, home } from '#lib/slices.ts'
import type { PageServerLoad } from './$types'

// The co-op's home: the widgets pinned from many collections, the
// viewer's own from the address (`w`) or else the co-op's, each checked
// against its collection's fields and run over that collection's rows as
// the acting member sees them; and, for the collection being edited
// (`c`), its enumerations' values.
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
  const today = new Date().toISOString().slice(0, 10)
  return using(locals.actor, async (db) => {
    const read = new Map<string, { id: string }[]>()
    const of = async (name: string) => read.get(name) ?? read.set(name, await rows(db, name, locals.actor)).get(name) ?? []
    const results = []
    for (const p of checked.pins) {
      const [r] = aggregate([p], await of(p.collection), known(p.collection) ?? [], today)
      results.push({ ...r, from: { label: collection(p.collection)?.view.title ?? p.collection, href: `/${p.collection}` } })
    }
    const fs = known(editing) ?? []
    const shown = await of(editing)
    const values = Object.fromEntries(
      fs.filter((f) => f.type === 'enum').map((f) => [f.key, [...new Set(shown.map((r) => String(f.value(r) ?? '')))].filter(Boolean).sort()]),
    )
    return { pins: checked.pins, custom: asked !== null, errors: [...errors, ...checked.errors], results, editing, values }
  })
}
