import type { Outcome } from '@cella/org-ops'
import { write, type Deps } from '@cella/org-db'
import type { ops } from '../models/ops.ts'
import type { Enrol, Enrolled } from '../models/key.ts'

const op = 'key:key:enrol' satisfies keyof typeof ops

// Enrols a device under the member's address on the verdict date, naming
// the device that signed. The keyring has already checked that the signer
// is a current device of the actor; `key.enrols` that the address is the
// actor's and the row this write's.
export async function enrol(input: Enrol, deps: Deps): Promise<Outcome<(typeof ops)[typeof op], Enrolled>> {
  return write(deps, {
    op,
    request: input,
    state: async (tx, proof) => {
      const { rows } = await tx.query<{ enrolled: string }>(
        `INSERT INTO key.device (key, address, label, enrolled, enrolled_by)
         VALUES (decode($1, 'hex'), $2, $3, cella.verdict_date(), decode($4, 'hex'))
         ON CONFLICT (key) DO NOTHING
         RETURNING to_char(enrolled, 'YYYY-MM-DD') AS enrolled`,
        [input.key, input.address, input.label, proof.device],
      )
      return { ...input, enrolled: rows[0]?.enrolled ?? '' }
    },
    // The label is the member's own wording and stays out of the log.
    payload: (v) => ({ address: v.address, key: v.key, enrolled: v.enrolled }),
  })
}
