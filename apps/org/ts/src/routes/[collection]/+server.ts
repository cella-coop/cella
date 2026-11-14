import { error } from '@sveltejs/kit'
import { counts } from '@cella/org-db'
import { fields, wheres } from '@cella/org-ui/models'
import { using } from '#lib/server/db.ts'
import { lensed } from '#lib/server/lens.ts'
import { source } from '#lib/server/slices.ts'
import { columns } from '#lib/slices.ts'
import type { RequestHandler } from './$types'

// How many rows each of some views keeps, asked as JSON beside the
// collection's page: the views a viewer keeps in their browser, which the
// server renders the page without. `where` is a list of each view's
// conditions, and `across` whether each reads across circles; a view
// whose conditions fail their check counts null. Each counts through the
// member's lens, as the page's own tabs do, but one reading across
// circles, which counts every circle's rows the member reads.
export const GET: RequestHandler = async ({ params, url, locals, cookies }) => {
  const named = source(params.collection)
  if (!named) {
    error(404, `There is no collection ${params.collection}`)
  }
  let asked: unknown
  let wide: unknown
  try {
    asked = JSON.parse(url.searchParams.get('where') ?? '[]')
    wide = JSON.parse(url.searchParams.get('across') ?? '[]')
  } catch {
    error(400, 'where is a JSON list of conditions, and across a JSON list of booleans')
  }
  if (!Array.isArray(asked) || asked.length > 50 || !Array.isArray(wide)) {
    error(400, 'where is a list of at most 50 views’ conditions, and across a list beside it')
  }
  const fs = fields(columns(params.collection))
  const checked = asked.map((w, i) => {
    try {
      return { where: wheres(w, fs), across: wide[i] === true }
    } catch {
      return null
    }
  })
  return using(locals.actor, async (db) => {
    const through = source(params.collection, await lensed(db, cookies, locals.actor)) ?? named
    const counted = new Map<object, number>()
    for (const [from, across] of [[through, false], [named, true]] as const) {
      const kept = checked.filter((k) => k !== null).filter((k) => k.across === across)
      const n = kept.length ? await counts(db, from, kept) : []
      kept.forEach((k, i) => counted.set(k, n[i] ?? 0))
    }
    return Response.json(checked.map((k) => (k ? (counted.get(k) ?? 0) : null)))
  })
}
