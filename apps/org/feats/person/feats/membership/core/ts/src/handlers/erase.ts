import type { Outcome } from '@cella/org-ops'
import { erasure, write, type Deps } from '@cella/org-db'
import type { ops } from '../models/ops.ts'
import type { Erase } from '../models/member.ts'

type Op = keyof typeof ops

// Erases the personal data of a member who has left, every class, by the
// decision that asks it. The notary carries it out as the write settles:
// their name and contact details, the person's, are deleted from the
// vault and redacted; what the law keeps, payroll and books, is restricted
// until its clock runs out. `membership.erases` checks the member left and
// the erasure is whole; the decision-membership graft, that the decision
// asks it.
export async function erase(input: Erase, deps: Deps): Promise<Outcome<(typeof ops)['membership:member:erase'], { member: string }>> {
  return write(deps, {
    op: 'membership:member:erase' satisfies Op,
    request: input,
    state: async () => ({ member: input.member }),
    payload: (v) => ({ member: v.member, decision: input.decision, erasure: erasure(v.member) }),
  })
}
