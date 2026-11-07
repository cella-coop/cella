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
// conditions; a view whose conditions fail their check counts null. Each
// counts through the member's lens, as the page's own tabs do.
export const GET: RequestHandler = async ({ params, url, locals, cookies }) => {
  const named = source(params.collection)
  if (!named) {
    error(404, `There is no collection ${params.collection}`)
  }
  let asked: unknown
  try {
    asked = JSON.parse(url.searchParams.get('where') ?? '[]')
  } catch {
    error(400, 'where is a JSON list of conditions')
  }
  if (!Array.isArray(asked) || asked.length > 50) {
    error(400, 'where is a list of at most 50 views’ conditions')
  }
  const fs = fields(columns(params.collection))
  const checked = asked.map((w) => {
    try {
      return { where: wheres(w, fs) }
    } catch {
      return null
    }
  })
  return using(locals.actor, async (db) => {
    const kept = checked.filter((k) => k !== null)
    const n = await counts(db, source(params.collection, await lensed(db, cookies, locals.actor)) ?? named, kept)
    let i = 0
    return Response.json(checked.map((k) => (k ? (n[i++] ?? 0) : null)))
  })
}
