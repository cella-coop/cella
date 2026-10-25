import type { Db, Deps } from '@cella/org-db'
import { devices } from '@cella/org-key/api'
import { scope } from '@cella/org-log/api'
import { fixture, signer, type Device } from '@cella/org-sign'

// DEV ONLY. A member's device, to sign as them: the TEST-ONLY fixture key
// derived from their address and a device's label, used only if it is the
// key enrolled under that label and not revoked. A real member's device
// holds a key no one can derive, so this signs for fixture members alone.
// The dev server signs with it, and so does `cella import`.

async function derived(address: string, label: string, enrolled: string): Promise<Device | null> {
  const d = await fixture(address, label)
  return d.key === enrolled ? d : null
}

export async function own(db: Db, address: string): Promise<Device | null> {
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

// The deps a write runs with, signing as `actor` from their fixture
// device; or why no device signs.
export async function signing(db: Db, actor: string): Promise<Deps | string> {
  const device = await own(db, actor)
  if (!device) {
    return `${actor} has no fixture device in force to sign with`
  }
  const address = await scope(db)
  if (!address) {
    return 'the database names no scope; seed it with `cella db reset --seed lanterne`'
  }
  return { db, actor, sign: signer(address, actor, device) }
}
