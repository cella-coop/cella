import type { Db, Deps } from '@cella/org-db'
import { devices } from '@cella/org-key/api'
import { scope } from '@cella/org-log/api'
import { members } from '@cella/org-member/api'
import { workers } from '@cella/org-worker/api'
import { fixture, signer, type Device } from '@cella/org-sign'
import { CELLA_DEV } from '$app/env/private'

// DEV ONLY. A member's device, for the dev server to sign as them: the
// TEST-ONLY fixture key derived from their address and a device's label,
// used only if it is the key enrolled under that label and not revoked. A
// real member's device holds a key no one can derive, so this signs for
// fixture members alone; outside dev mode it signs for no one.

export const dev = CELLA_DEV

async function derived(address: string, label: string, enrolled: string): Promise<Device | null> {
  const d = await fixture(address, label)
  return d.key === enrolled ? d : null
}

async function own(db: Db, address: string): Promise<Device | null> {
  for (const d of await devices(db, address)) {
    if (d.revoked) {
      continue
    }
    const found = await derived(address, d.label, d.key)
    if (found) {
      return found
    }
  }
  return null
}

// Who the dev server can act as: members, and workers who are not, with a
// fixture device in force.
export async function actors(db: Db): Promise<{ address: string; name: string }[]> {
  if (!dev) {
    return []
  }
  const people = await members(db)
  const known = new Set(people.map((m) => m.address))
  const all = [...people, ...(await workers(db)).filter((w) => !known.has(w.address))]
  const out = []
  for (const m of all) {
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
  const device = await own(db, actor)
  if (!device) {
    return `${actor} has no fixture device in force for the dev server to sign with`
  }
  const address = await scope(db)
  if (!address) {
    return 'the database names no scope; seed it with `cella db reset --seed lanterne`'
  }
  return { db, actor, sign: signer(address, actor, device) }
}
