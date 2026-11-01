import type { Outcome } from '@cella/org-actions'
import { write, type Db, type Deps, type Write } from '@cella/org-db'
import type { actions } from '../models/actions.ts'
import type { Admit, Admitted } from '../models/member.ts'

const op = 'membership:member:admit'

// Makes an invited member active, since the verdict date, with their
// shares; a member already admitted is left as they are, for the guards to
// refuse. A graft that admits as part of another write, as the close of
// the decision that admits, runs this inside that write's transaction.
export async function admitting(tx: Db, input: Admit): Promise<Admitted> {
  const { rows } = await tx.query<{ since: string }>(
    `UPDATE membership.member SET status = 'active', since = cella.verdict_date(), shares = $2
     WHERE address = $1 AND status = 'invited'
     RETURNING to_char(since, 'YYYY-MM-DD') AS since`,
    [input.member, input.shares],
  )
  return { member: input.member, since: rows[0]?.since ?? '' }
}

// The admission as a write of its own, citing the decision. The guards on
// this op decide: `membership.admitted` that the write did so, the
// decision-membership graft's that the cited decision admits, and
// circle-decision-membership's that it closed and passed on its roll.
export async function admit(input: Admit, deps: Deps): Promise<Outcome<(typeof actions)[typeof op], Admitted>> {
  const w: Write<Admitted> = {
    op,
    request: input,
    state: (tx) => admitting(tx, input),
    payload: () => ({ ...input }),
  }
  return write(deps, w)
}
