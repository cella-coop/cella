import type { Db, Deps } from '@cella/org-db'
import { people } from '@cella/org-person/api'
import { CELLA_DEV } from '$app/env/private'
import { own, signing } from './fixture.ts'

// DEV ONLY. The dev server signs a write as the member picked in the user
// menu, from their fixture device (`fixture.ts`); outside dev mode it signs
// for no one.

export const dev = CELLA_DEV

// Who the dev server can act as: everyone the co-op knows with a fixture
// device in force.
export async function actors(db: Db): Promise<{ address: string; name: string }[]> {
  if (!dev) {
    return []
  }
  const out = []
  for (const m of await people(db)) {
    if (await own(db, m.address)) {
      out.push({ address: m.address, name: m.name })
    }
  }
  return out
}

// The deps a write runs with, signing as `actor` from their fixture device;
// or why no device signs.
export async function deps(db: Db, actor: string | null): Promise<Deps | string> {
  if (!dev) {
    return 'this server signs for no one: writes come from a member’s own device, which is not built; acting as a member is for `cella serve` only'
  }
  if (!actor) {
    return 'act as a member first, from the menu at the top of the sidebar'
  }
  return signing(db, actor)
}
