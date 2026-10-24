import { scope } from '@cella/org-log/api'
import { using } from '#lib/server/db.ts'
import { actors, dev } from '#lib/server/device.ts'
import type { LayoutServerLoad } from './$types'

export const load: LayoutServerLoad = async ({ locals, cookies }) =>
  using(async (db) => {
    const people = await actors(db)
    return {
      scope: (await scope(db)) ?? 'no scope',
      actor: people.find((p) => p.address === locals.actor) ?? null,
      actors: people,
      dev,
      theme: locals.theme,
      // Whether the viewer left the drawer open, which the shell's toggle
      // keeps in a cookie.
      drawer: cookies.get('cella-drawer') !== 'closed',
    }
  })
