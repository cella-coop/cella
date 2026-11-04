import { devices, person } from '@cella/org-person/api'
import { CELLA_DEV } from '$app/env/private'
import { using } from './db.ts'
import { own } from './fixture.ts'

// DEV ONLY. The dev server's sign-in page offers the fixture members:
// the browser derives the TEST-ONLY key of the device picked
// (`fixture` in `@cella/org-sign`), keeps it as its own and signs in and
// signs each write with it, as with any device. The server signs nothing,
// in dev mode or not; outside dev mode the page offers no one.

export const dev = CELLA_DEV

// Who the dev server's sign-in page offers: everyone with a fixture
// device in force, and that device's label, by name. The keyring reads
// for anyone; each person's name is read as them, since no one signed in
// reads anyone's record and everyone reads their own.
export async function fixtures(): Promise<{ address: string; name: string; label: string }[]> {
  if (!dev) {
    return []
  }
  const addresses = [...new Set((await using(null, (db) => devices(db))).map((d) => d.address))]
  const out = []
  for (const address of addresses) {
    const found = await using(address, async (db) => ({ p: await person(db, address), d: await own(db, address) }))
    if (found.p && found.d) {
      out.push({ address, name: found.p.name, label: found.d.label })
    }
  }
  return out.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
}
