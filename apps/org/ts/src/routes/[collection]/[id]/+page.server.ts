import { error, type Actions } from '@sveltejs/kit'
import { using } from '#lib/server/db.ts'
import { mounted, writes } from '#lib/server/slices.ts'
import { perform } from '#lib/server/write.ts'
import type { PageServerLoad } from './$types'

// An item: its owner's data, given the address, and each extension's data
// on it, by slice.
export const load: PageServerLoad = async ({ params, url, locals }) => {
  const m = mounted(params.collection)
  const item = m?.collection.item
  if (!m || !item) {
    error(404, `There is no collection ${params.collection} with pages`)
  }
  return using(locals.actor, async (db) => {
    const found = await item(db, params.id, url.searchParams)
    if (!found) {
      error(404, `${params.collection} has no ${params.id}`)
    }
    const added = await Promise.all(
      m.extensions.filter((e) => e.extension.item).map(async (e) => [e.slice.name, await e.extension.item?.(db, params.id, locals.actor)] as const),
    )
    // Who looks, for a block that offers what only the viewer may do.
    const viewer = locals.session && { actor: locals.session.actor, device: locals.session.device }
    return { name: params.collection, id: params.id, item: found, added: Object.fromEntries(added), viewer }
  })
}

export const actions = Object.fromEntries(
  writes.map((w) => [w, (event: Parameters<Actions[string]>[0]) => perform(event, event.params.collection ?? '', w, event.params.id)]),
) satisfies Actions
