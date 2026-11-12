import { counts } from '@cella/org-db'
import { named } from '@cella/org-log/api'
import { people, person } from '@cella/org-person/api'
import { using } from '#lib/server/db.ts'
import { dev } from '#lib/server/device.ts'
import { lensing } from '#lib/server/lens.ts'
import { source } from '#lib/server/slices.ts'
import { counted } from '#lib/slices.ts'
import type { LayoutServerLoad } from './$types'

export const load: LayoutServerLoad = async ({ locals, cookies, depends }) => {
  // Read again after a settled write, as its counts may have moved.
  depends('cella:shell')
  return using(locals.actor, async (db) => {
    const s = await named(db)
    const someone = locals.actor ? await person(db, locals.actor) : null
    // The circles the co-op selector offers, and the one the member lensed
    // the co-op on, if any.
    const lensed = someone ? await lensing(db, cookies, someone.address) : { circles: [], lens: null }
    // How many rows the counted collections hold for the signed-in member,
    // as what waits on them: the owner's and its extensions', counted in
    // SQL. `waiting` is every one of them, whole whatever the lens, as a
    // shut section's dot reads it; `held` those in the lensed circle, the
    // count the collection's page heads with, as its pill reads it.
    const waiting: Record<string, number> = {}
    const held: Record<string, number> = {}
    for (const name of someone ? counted() : []) {
      const whole = source(name)
      const through = source(name, lensed.lens?.id ?? null)
      waiting[`/${name}`] = whole ? ((await counts(db, whole, [{ where: [] }]))[0] ?? 0) : 0
      held[`/${name}`] = through?.lens ? ((await counts(db, through, [{ where: [] }]))[0] ?? 0) : waiting[`/${name}`]
    }
    return {
      scope: { address: s.address ?? 'no scope', name: s.name ?? s.address ?? 'No scope', legal: s.legal },
      actor: someone && { address: someone.address, name: someone.name },
      // Everyone the co-op knows, by address, so a person shows by name
      // wherever a page names them.
      people: someone ? Object.fromEntries((await people(db)).map((p) => [p.address, p.name])) : {},
      dev,
      counts: held,
      waiting,
      circles: lensed.circles,
      lens: lensed.lens,
      theme: locals.theme,
      // Whether the viewer left the drawer open, which the shell's toggle
      // keeps in a cookie.
      drawer: cookies.get('cella-drawer') !== 'closed',
    }
  })
}
