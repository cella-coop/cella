import { named } from '@cella/org-log/api'
import { using } from '#lib/server/db.ts'
import { actors, dev } from '#lib/server/device.ts'
import { rows } from '#lib/server/slices.ts'
import { counted } from '#lib/slices.ts'
import type { LayoutServerLoad } from './$types'

export const load: LayoutServerLoad = async ({ locals, cookies }) =>
  using(async (db) => {
    const people = await actors(db)
    const s = await named(db)
    // How many rows the counted collections hold for the acting member,
    // as what waits on them: the owner's and its extensions'.
    const counts: Record<string, number> = {}
    for (const name of counted()) {
      if (locals.actor) {
        counts[`/${name}`] = (await rows(db, name, locals.actor)).length
      }
    }
    return {
      scope: { address: s.address ?? 'no scope', name: s.name ?? s.address ?? 'No scope', legal: s.legal },
      actor: people.find((p) => p.address === locals.actor) ?? null,
      actors: people,
      dev,
      counts,
      theme: locals.theme,
      // Whether the viewer left the drawer open, which the shell's toggle
      // keeps in a cookie.
      drawer: cookies.get('cella-drawer') !== 'closed',
    }
  })
