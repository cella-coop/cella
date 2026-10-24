import type { Outcome } from '@cella/org-ops'
import { write, type Deps } from '@cella/org-db'
import type { ops } from '../models/ops.ts'
import type { Profile, Profiled } from '../models/member.ts'

const op = 'member:member:profile' satisfies keyof typeof ops

// Sets the given fields of a member's profile. `member.own_profile` refuses
// anyone but the member; the log commits to the field names only.
export async function profile(input: Profile, deps: Deps): Promise<Outcome<(typeof ops)[typeof op], Profiled>> {
  return write(deps, {
    op,
    request: input,
    state: async (tx) => {
      const fields = input.name === undefined ? [] : ['name']
      if (input.name !== undefined) {
        await tx.query('UPDATE member.member SET name = $2 WHERE address = $1', [input.member, input.name])
      }
      return { member: input.member, fields }
    },
    payload: (v) => ({ member: v.member, fields: [...v.fields] }),
  })
}
