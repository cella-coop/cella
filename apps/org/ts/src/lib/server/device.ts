import { devices, person } from '@cella/org-person/api'
import { CELLA_DEMO, CELLA_DEV } from '$app/env/private'
import { using } from './db.ts'
import { own } from './fixture.ts'

// DEV AND DEMO ONLY. The dev server's sign-in page offers the fixture
// members: the browser derives the TEST-ONLY key of the device picked
// (`fixture` in `@cella/org-sign`), keeps it as its own and signs in and
// signs each write with it, as with any device. A demo build, a
// production build serving a mock co-op, offers them too, each marked as
// a demo member, and wears the demo's banner on every page. The server
// signs nothing, in either mode or none; a production build that is no
// demo offers no one.

export const dev = CELLA_DEV
export const demo = CELLA_DEMO

// Who the sign-in page offers in dev mode or a demo: everyone with a
// fixture device in force, and that device's label, by name. The keyring
// reads for anyone; each person's name is read as them, since no one
// signed in reads anyone's record and everyone reads their own.
export async function fixtures(): Promise<{ address: string; name: string; label: string }[]> {
  if (!dev && !demo) {
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
