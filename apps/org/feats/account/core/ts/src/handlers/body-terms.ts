import type { Outcome } from '@cella/org-actions'
import { write, type Deps } from '@cella/org-db'
import type { actions } from '../models/actions.ts'
import type { BodySaveTerms, BodySavedTerms } from '../models/body-terms.ts'

type Action = keyof typeof actions

// Saves a record's body: the merged snapshot an editor's browser signs,
// with who contributed since the last save, each of whom the feat's
// guard asks holds `discuss` in the record's circle, as the saver must.
// Its `base`, the hash of the saved body the browser merged, goes in the
// payload with `replaced`, the hash of the body it replaces, read under
// the row's lock; the feat's guard refuses the save where they differ.
export async function saveBodyTerms(input: BodySaveTerms, deps: Deps): Promise<Outcome<(typeof actions)['account:body:save-terms'], BodySavedTerms>> {
  let snapshot = ''
  let replaced = ''
  return write(deps, {
    op: 'account:body:save-terms' satisfies Action,
    request: input,
    state: async (tx) => {
      const held = await tx.query<{ replaced: string }>(
        `SELECT coalesce(encode(sha256(body), 'hex'), '') AS replaced FROM account.terms WHERE id = $1 FOR UPDATE`,
        [input.terms],
      )
      replaced = held.rows[0]?.replaced ?? ''
      const { rows } = await tx.query<{ circle: string; snapshot: string }>(
        `UPDATE account.terms SET body = $2 WHERE id = $1 RETURNING circle, encode(body, 'hex') AS snapshot`,
        [input.terms, input.snapshot],
      )
      if (!rows[0]) {
        throw new Error(`no record ${input.terms}`)
      }
      snapshot = rows[0].snapshot
      return { terms: input.terms, circle: rows[0].circle }
    },
    payload: (v) => ({ ...v, snapshot, base: input.base, replaced, contributors: [...new Set(input.contributors)].sort() }),
  })
}
