import type { Outcome } from '@cella/org-actions'
import { write, type Deps } from '@cella/org-db'
import type { actions } from '../models/actions.ts'
import type { BodySave, BodySaved } from '../models/body.ts'

type Action = keyof typeof actions

// Saves a record's body: the merged snapshot an editor's browser signs,
// with who contributed since the last save, each of whom the feat's
// guard asks holds `discuss` in the record's circle, as the saver must.
// Its `base`, the hash of the saved body the browser merged, goes in the
// payload with `replaced`, the hash of the body it replaces, read under
// the row's lock; the feat's guard refuses the save where they differ.
export async function saveBody(input: BodySave, deps: Deps): Promise<Outcome<(typeof actions)['bill:body:save'], BodySaved>> {
  let snapshot = ''
  let replaced = ''
  return write(deps, {
    op: 'bill:body:save' satisfies Action,
    request: input,
    state: async (tx) => {
      const held = await tx.query<{ replaced: string }>(
        `SELECT coalesce(encode(sha256(body), 'hex'), '') AS replaced FROM bill.bill WHERE id = $1 FOR UPDATE`,
        [input.bill],
      )
      replaced = held.rows[0]?.replaced ?? ''
      const { rows } = await tx.query<{ circle: string; snapshot: string }>(
        `UPDATE bill.bill SET body = $2 WHERE id = $1 RETURNING circle, encode(body, 'hex') AS snapshot`,
        [input.bill, input.snapshot],
      )
      if (!rows[0]) {
        throw new Error(`no record ${input.bill}`)
      }
      snapshot = rows[0].snapshot
      return { bill: input.bill, circle: rows[0].circle }
    },
    payload: (v) => ({ ...v, snapshot, base: input.base, replaced, contributors: [...new Set(input.contributors)].sort() }),
  })
}
