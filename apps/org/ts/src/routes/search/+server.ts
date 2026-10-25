import { using } from '#lib/server/db.ts'
import { mounted, slices } from '#lib/server/slices.ts'
import type { RequestHandler } from './$types'

// Every item the command menu can jump to, from each collection's index.
export const GET: RequestHandler = async ({ locals }) =>
  using(locals.actor, async (db) => {
    const names = slices.flatMap((s) => Object.keys(s.collections ?? {}))
    const items = await Promise.all(
      names.map(async (name) => {
        const index = mounted(name)?.collection.index
        const entries = index ? await index(db) : []
        return entries.map((e) => ({ title: e.title, sub: e.sub, href: `/${name}/${encodeURIComponent(e.id)}`, kind: name }))
      }),
    )
    return Response.json(items.flat())
  })
