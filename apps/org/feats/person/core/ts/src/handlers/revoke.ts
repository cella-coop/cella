import type { Outcome } from '@cella/org-ops'
import { write, type Deps } from '@cella/org-db'
import type { ops } from '../models/ops.ts'
import type { Revoke, Revoked } from '../models/device.ts'

const op = 'person:device:revoke' satisfies keyof typeof ops

// Revokes a device on the verdict date. Signed from another of the
// person's devices: the keyring reads the write's own state, so a device
// revoking itself is no longer current when the notary checks it.
export async function revoke(input: Revoke, deps: Deps): Promise<Outcome<(typeof ops)[typeof op], Revoked>> {
  return write(deps, {
    op,
    request: input,
    state: async (tx) => {
      const { rows } = await tx.query<{ revoked: string }>(
        `UPDATE person.device SET revoked = cella.verdict_date()
         WHERE key = decode($1, 'hex') AND revoked IS NULL
         RETURNING to_char(revoked, 'YYYY-MM-DD') AS revoked`,
        [input.key],
      )
      return { key: input.key, revoked: rows[0]?.revoked ?? '' }
    },
    payload: (v) => ({ ...v }),
  })
}
