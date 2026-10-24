import type { Refused, Settled } from '@cella/org-ops'
import type { Deps } from '@cella/org-db'
import { admit } from '@cella/org-member/api'
import type { Admitted } from '@cella/org-member/models'

// Reacts to a settled close: admits each member the decision asks to admit,
// when it passes. Whether it passes is `decision_member.passes`, asked of
// the database; each admission is its own ordered write, and its rules
// decide again.
export async function closed(decision: string, deps: Deps): Promise<(Settled<Admitted> | Refused)[]> {
  const { rows } = await deps.db.query<{ member: string; shares: number; passes: boolean }>(
    `SELECT a.member, a.shares, decision_member.passes(a.decision) AS passes
     FROM decision_member.admission a
     WHERE a.decision = $1
     ORDER BY a.member`,
    [decision],
  )
  const out: (Settled<Admitted> | Refused)[] = []
  for (const a of rows.filter((r) => r.passes)) {
    const admitted = await admit({ member: a.member, shares: a.shares, decision }, deps)
    if (admitted.state === 'pending') {
      throw new Error('an admission on the server settles or is refused at once')
    }
    out.push(admitted)
  }
  return out
}
