import type { Outcome } from '@cella/org-actions'
import { personal, write, type Deps } from '@cella/org-db'
import type { actions } from '../models/actions.ts'
import type { Enrol, Enrolled } from '../models/device.ts'

const op = 'person:device:enrol' satisfies keyof typeof actions

// Enrols a device under the person's address on the verdict date, naming
// the device that signed. The keyring has already checked that the signer
// is a current device of the actor; `person.enrols` that the address is the
// actor's and the row this write's.
export async function enrol(input: Enrol, deps: Deps): Promise<Outcome<(typeof actions)[typeof op], Enrolled>> {
  return write(deps, {
    op,
    request: input,
    state: async (tx, proof) => {
      const { rows } = await tx.query<{ enrolled: string }>(
        `INSERT INTO person.device (key, address, label, enrolled, enrolled_by)
         VALUES (decode($1, 'hex'), $2, $3, cella.verdict_date(), decode($4, 'hex'))
         ON CONFLICT (key) DO NOTHING
         RETURNING to_char(enrolled, 'YYYY-MM-DD') AS enrolled`,
        [input.key, input.address, input.label, proof.device],
      )
      return { ...input, by: proof.device, enrolled: rows[0]?.enrolled ?? '' }
    },
    // The label is the person's own wording, personal data: the log
    // commits to it, and to the device that signed the enrolment.
    payload: (v) => ({ address: v.address, key: v.key, label: personal('person.device.label', v.address, v.label), by: v.by, enrolled: v.enrolled }),
  })
}
