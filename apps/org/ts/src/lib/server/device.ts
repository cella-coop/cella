import type { Db } from '@cella/org-db'
import { people } from '@cella/org-person/api'
import { CELLA_DEV } from '$app/env/private'
import { own } from './fixture.ts'

// DEV ONLY. The dev server's sign-in page offers the fixture members:
// the browser derives the TEST-ONLY key of the device picked
// (`fixture` in `@cella/org-sign`), keeps it as its own and signs in and
// signs each write with it, as with any device. The server signs nothing,
// in dev mode or not; outside dev mode the page offers no one.

export const dev = CELLA_DEV

// Who the dev server's sign-in page offers: everyone the co-op knows with
// a fixture device in force, and that device's label.
export async function fixtures(db: Db): Promise<{ address: string; name: string; label: string }[]> {
  if (!dev) {
    return []
  }
  const out = []
  for (const m of await people(db)) {
    const d = await own(db, m.address)
    if (d) {
      out.push({ address: m.address, name: m.name, label: d.label })
    }
  }
  return out
}
