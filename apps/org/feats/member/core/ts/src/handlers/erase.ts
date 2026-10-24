import type { Outcome } from '@cella/org-ops'
import { erasure, write, type Deps } from '@cella/org-db'
import type { ops } from '../models/ops.ts'
import type { Erase, Forget } from '../models/member.ts'

type Op = keyof typeof ops

// Erases the personal data of a member who has left, every class, by the
// decision that asks it. The notary carries it out as the write settles:
// their name and contact details are deleted from the vault and redacted
// here; what the law keeps, payroll and books, is restricted until its
// clock runs out. `member.erases` checks the member left and the erasure
// is whole; the decision-member graft, that the decision asks it.
export async function erase(input: Erase, deps: Deps): Promise<Outcome<(typeof ops)['member:member:erase'], { member: string }>> {
  return write(deps, {
    op: 'member:member:erase' satisfies Op,
    request: input,
    state: async () => ({ member: input.member }),
    payload: (v) => ({ member: v.member, decision: input.decision, erasure: erasure(v.member) }),
  })
}

// A member erases their own contact details, which the notary deletes
// from the vault and redacts here; `member.forgets` refuses anyone else's.
export async function forget(input: Forget, deps: Deps): Promise<Outcome<(typeof ops)['member:member:forget'], { member: string }>> {
  return write(deps, {
    op: 'member:member:forget' satisfies Op,
    request: input,
    state: async () => ({ member: input.member }),
    payload: (v) => ({ member: v.member, erasure: erasure(v.member, ['contact']) }),
  })
}
