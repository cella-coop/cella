import { today } from '@cella/org-db'
import { circles, sitting } from '@cella/org-circle/api'
import { devices, person } from '@cella/org-person/api'
import { CELLA_DEMO, CELLA_DEMO_ENDS, CELLA_DEMO_IDLE, CELLA_DEV } from '$app/env/private'
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
// A visitor's copy, served by `cella demo serve`: the seconds idle before
// it resets, else 0.
export const copy = CELLA_DEMO && CELLA_DEMO_IDLE ? CELLA_DEMO_IDLE : 0
// And when it resets however busy, in seconds since 1970, else 0.
export const ends = copy ? CELLA_DEMO_ENDS : 0

// Who the sign-in page offers in dev mode or a demo: everyone with a
// fixture device in force, that device's label, by name, and the circles
// they sit in now, the assembly left out since every member is in it. The
// keyring reads for anyone; each person's name and seats are read as
// them, since no one signed in reads anyone's record and everyone reads
// their own.
export async function fixtures(): Promise<{ address: string; name: string; label: string; circles: string[] }[]> {
  if (!dev && !demo) {
    return []
  }
  const addresses = [...new Set((await using(null, (db) => devices(db))).map((d) => d.address))]
  const out = []
  for (const address of addresses) {
    const found = await using(address, async (db) => {
      const day = await today(db)
      return { p: await person(db, address), d: await own(db, address), all: await circles(db), sat: await sitting(db, address, day, day) }
    })
    if (found.p && found.d) {
      const assembly = found.all.find((c) => c.assembly)?.id
      out.push({ address, name: found.p.name, label: found.d.label, circles: found.sat.filter((c) => c.id !== assembly).map((c) => c.name) })
    }
  }
  return out.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
}
