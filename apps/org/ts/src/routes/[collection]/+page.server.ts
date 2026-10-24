import { error, type Actions } from '@sveltejs/kit'
import { using } from '#lib/server/db.ts'
import { mounted, writes } from '#lib/server/slices.ts'
import { perform } from '#lib/server/write.ts'
import type { PageServerLoad } from './$types'

// A collection: its owner's rows, with the fields its extensions add to
// each, and what its header says about it.
export const load: PageServerLoad = async ({ params }) => {
  const m = mounted(params.collection)
  if (!m) {
    error(404, `There is no collection ${params.collection}`)
  }
  return using(async (db) => {
    const rows = await m.collection.list(db)
    const added = await Promise.all(m.extensions.map((e) => e.extension.list?.(db)))
    return {
      name: params.collection,
      rows: rows.map((r) => Object.assign({}, r, ...added.map((a) => a?.[r.id]))),
      about: (await m.collection.about?.(db)) ?? null,
    }
  })
}

export const actions = Object.fromEntries(
  writes.map((w) => [w, (event: Parameters<Actions[string]>[0]) => perform(event, event.params.collection ?? '', w)]),
) satisfies Actions
