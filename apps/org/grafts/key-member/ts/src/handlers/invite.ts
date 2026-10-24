import type { Refused, Settled } from '@cella/org-ops'
import { write, type Deps } from '@cella/org-db'
import { inviting } from '@cella/org-member/api'
import type { Invited } from '@cella/org-member/models'
import type { Invite } from '../models/index.ts'

// Invites someone with their first device, in one write: the member
// feat's invitation, then the device it carries, which their admission
// enrols. The payload commits to the key, so the log says which device
// the admission enrolled; the label stays out.
export async function invite(input: Invite, deps: Deps): Promise<Settled<Invited & { key: string }> | Refused> {
  const key = input.key.trim().toLowerCase()
  if (!/^[0-9a-f]{64}$/.test(key)) {
    throw new Error('a device key is 32 bytes in hex, as the invitee’s device shows it')
  }
  const w = inviting({ address: input.address, name: input.name })
  return write(deps, {
    op: w.op,
    request: input,
    state: async (tx, proof) => {
      const value = await w.state(tx, proof)
      const carried = await tx.query(`SELECT member FROM key_member.invitation WHERE key = decode($1, 'hex')`, [key])
      if (carried.rowCount) {
        throw new Error('another invitation carries this device key')
      }
      await tx.query(`INSERT INTO key_member.invitation (member, key, label) VALUES ($1, decode($2, 'hex'), $3)`, [
        input.address,
        key,
        input.label,
      ])
      return { ...value, key }
    },
    payload: (v) => ({ ...w.payload(v), key: v.key }),
  })
}
