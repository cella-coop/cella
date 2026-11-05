// Lanterne's people's devices, as their clients hold them: TEST-ONLY keys
// derived from each device's address and label, the same the seed enrols.

import { readFileSync } from 'node:fs'
import { parse } from 'smol-toml'
import type { Db } from '@cella/org-db'
import { fixture, signer, type Device, type Signer } from '@cella/org-sign'

const dir = new URL('../../fixtures/lanterne/', import.meta.url)
const toml = <T>(file: string) => parse(readFileSync(new URL(file, dir), 'utf8')) as T

export const scope = toml<{ address: string }>('scope.toml').address

const devices = toml<{ device: { address: string; label: string; revoked?: unknown }[] }>('person.toml').device
const held = new Map<string, Promise<Device>>()

// A member's device: by its label, or their first one not revoked.
export function device(address: string, label?: string): Promise<Device> {
  const d = devices.find((x) => x.address === address && (label ? x.label === label : !x.revoked))
  if (!d) {
    throw new Error(`${address} has no device ${label ?? 'in force'} in the fixture`)
  }
  const id = `${d.address}/${d.label}`
  if (!held.has(id)) {
    held.set(id, fixture(d.address, d.label))
  }
  return held.get(id) as Promise<Device>
}

// Signs as `actor` from one of their devices, or from `of`'s.
export const sign = (actor: string, label?: string, of = actor): Signer => signer(scope, actor, device(of, label))

// A connection held throughout that reads as `actor`, as a borrow of the
// shell's `using` does: `cella.actor` set before each statement, so the row-level
// policies read the circles their mandates cover. A transaction's own
// statements go as they are, so a rollback still ends an aborted one.
export const reader = (db: Db, actor: string): Db => ({
  query: async <R = Record<string, unknown>>(text: string, values?: unknown[]) => {
    if (!/^\s*(BEGIN|COMMIT|ROLLBACK|SAVEPOINT|RELEASE)\b/i.test(text)) {
      await db.query(`SELECT set_config('cella.actor', $1, false)`, [actor])
    }
    return db.query<R>(text, values)
  },
})
