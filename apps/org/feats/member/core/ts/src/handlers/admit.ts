import type { Outcome } from '@cella/org-ops'
import { write, type Db, type Deps, type Write } from '@cella/org-db'
import type { ops } from '../models/ops.ts'
import type { Admit, Admitted } from '../models/member.ts'

const op = 'member:member:admit'

// Makes an invited member active, since the verdict date, with their
// shares; a member already admitted is left as they are, for the rules to
// refuse. A graft that admits as part of another write, as the close of
// the decision that admits, runs this inside that write's transaction.
export async function admitting(tx: Db, input: Admit): Promise<Admitted> {
  const { rows } = await tx.query<{ since: string }>(
    `UPDATE member.member SET status = 'active', since = cella.verdict_date(), shares = $2
     WHERE address = $1 AND status = 'invited'
     RETURNING to_char(since, 'YYYY-MM-DD') AS since`,
    [input.member, input.shares],
  )
  return { member: input.member, since: rows[0]?.since ?? '' }
}

// The admission as a write of its own, citing the decision. The rules on
// this op decide: `member.admitted` that the write did so, the
// decision-member graft's that the cited decision admits, and
// circle-decision-member's that it closed and passed on its roll.
export async function admit(input: Admit, deps: Deps): Promise<Outcome<(typeof ops)[typeof op], Admitted>> {
  const w: Write<Admitted> = {
    op,
    request: input,
    state: (tx) => admitting(tx, input),
    payload: () => ({ ...input }),
  }
  return write(deps, w)
}
