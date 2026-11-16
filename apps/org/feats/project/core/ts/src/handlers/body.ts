import type { Outcome } from '@cella/org-actions'
import { write, type Deps } from '@cella/org-db'
import type { actions } from '../models/actions.ts'
import type { BodySave, BodySaved } from '../models/body.ts'

type Action = keyof typeof actions

// Saves a project's body: the merged snapshot an editor's browser signs, with
// who contributed since the last save, each of whom the feat's guard asks
// holds `discuss` in the project's circle, as the saver must. The payload
// names the circle the handler read, which the power's guard reads. Its
// `base`, the hash of the saved body the browser merged, goes in the
// payload with `replaced`, the hash of the body it replaces, read under
// the row's lock; the feat's guard refuses the save where they differ,
// so a stale snapshot never erases another editor's save. A snapshot
// with no canonical form is refused by the column.
export async function saveBody(input: BodySave, deps: Deps): Promise<Outcome<(typeof actions)['project:body:save'], BodySaved>> {
  let snapshot = ''
  let replaced = ''
  return write(deps, {
    op: 'project:body:save' satisfies Action,
    request: input,
    state: async (tx) => {
      const held = await tx.query<{ replaced: string }>(
        `SELECT coalesce(encode(sha256(body), 'hex'), '') AS replaced FROM project.project WHERE id = $1 FOR UPDATE`,
        [input.project],
      )
      replaced = held.rows[0]?.replaced ?? ''
      const { rows } = await tx.query<{ circle: string; snapshot: string }>(
        `UPDATE project.project SET body = $2 WHERE id = $1 RETURNING circle, encode(body, 'hex') AS snapshot`,
        [input.project, input.snapshot],
      )
      if (!rows[0]) {
        throw new Error(`no project ${input.project}`)
      }
      snapshot = rows[0].snapshot
      return { project: input.project, circle: rows[0].circle }
    },
    // The log keeps the snapshot, in hex, which its fold sets the body to,
    // the base it was merged from and the hash of the body it replaced, and
    // who contributed to it since the last.
    payload: (v) => ({ ...v, snapshot, base: input.base, replaced, contributors: [...new Set(input.contributors)].sort() }),
  })
}
