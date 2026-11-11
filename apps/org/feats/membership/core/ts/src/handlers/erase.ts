import type { Outcome } from '@cella/org-actions'
import { erasure, write, type Deps } from '@cella/org-db'
import type { actions } from '../models/actions.ts'
import type { Erase } from '../models/member.ts'

type Action = keyof typeof actions

// One who has left erases their own personal data, every class, by their
// right, signing it themselves and citing no motion. The notary carries
// it out as the write settles: their name and contact details, the
// person's, are deleted from the vault and redacted; what the law keeps,
// payroll and books, is restricted until its clock runs out.
// `membership.erases` checks the member is the actor, has left, and the
// erasure is whole.
export async function erase(input: Erase, deps: Deps): Promise<Outcome<(typeof actions)['membership:member:erase'], { member: string }>> {
  return write(deps, {
    op: 'membership:member:erase' satisfies Action,
    request: input,
    state: async () => ({ member: input.member }),
    payload: (v) => ({ member: v.member, erasure: erasure(v.member) }),
  })
}
