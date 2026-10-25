import { named } from '@cella/org-log/api'
import { person } from '@cella/org-person/api'
import { using } from '#lib/server/db.ts'
import { dev } from '#lib/server/device.ts'
import { rows } from '#lib/server/slices.ts'
import { counted } from '#lib/slices.ts'
import type { LayoutServerLoad } from './$types'

export const load: LayoutServerLoad = async ({ locals, cookies }) =>
  using(locals.actor, async (db) => {
    const s = await named(db)
    const someone = locals.actor ? await person(db, locals.actor) : null
    // How many rows the counted collections hold for the signed-in member,
    // as what waits on them: the owner's and its extensions'.
    const counts: Record<string, number> = {}
    for (const name of someone ? counted() : []) {
      counts[`/${name}`] = (await rows(db, name, someone?.address ?? null)).length
    }
    return {
      scope: { address: s.address ?? 'no scope', name: s.name ?? s.address ?? 'No scope', legal: s.legal },
      actor: someone && { address: someone.address, name: someone.name },
      dev,
      counts,
      theme: locals.theme,
      // Whether the viewer left the drawer open, which the shell's toggle
      // keeps in a cookie.
      drawer: cookies.get('cella-drawer') !== 'closed',
    }
  })
