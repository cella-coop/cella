import type { Refused, Settled } from '@cella/org-ops'
import { write, type Deps } from '@cella/org-db'
import { hiring } from '@cella/org-worker/api'
import type { Hired } from '@cella/org-worker/models'
import type { Hiring } from '../models/index.ts'

// Hires a worker with their first device, in one write: the worker feat's
// hire, then the device, enrolled on the verdict date by no device, so
// they sign their own time from their first day. The payload commits to
// the key; the label stays out.
export async function hire(input: Hiring, deps: Deps): Promise<Settled<Hired & { key: string }> | Refused> {
  const key = input.key.trim().toLowerCase()
  if (!/^[0-9a-f]{64}$/.test(key)) {
    throw new Error('a device key is 32 bytes in hex, as the worker’s device shows it')
  }
  const { key: _, label, ...contract } = input
  const w = hiring(contract)
  return write(deps, {
    op: w.op,
    request: input,
    state: async (tx, proof) => {
      const value = await w.state(tx, proof)
      const held = await tx.query(`SELECT FROM key.device WHERE key = decode($1, 'hex')`, [key])
      if (held.rowCount) {
        throw new Error('this device key is enrolled already')
      }
      await tx.query(
        `INSERT INTO key.device (key, address, label, enrolled) VALUES (decode($1, 'hex'), $2, $3, cella.verdict_date())`,
        [key, input.worker, label.trim()],
      )
      return { ...value, key }
    },
    payload: (v) => ({ ...w.payload(v), key: v.key }),
  })
}
