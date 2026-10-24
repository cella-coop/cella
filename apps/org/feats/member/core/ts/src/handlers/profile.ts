import type { Outcome } from '@cella/org-ops'
import { personal, write, type Deps } from '@cella/org-db'
import type { ops } from '../models/ops.ts'
import type { Profile, Profiled } from '../models/member.ts'

const op = 'member:member:profile' satisfies keyof typeof ops

// The fields a profile sets, in a fixed order; nothing else reaches SQL.
const columns = ['name', 'email', 'phone'] as const

// Sets the given fields of a member's profile. `member.own_profile` refuses
// anyone but the member; the log commits to each value under a fresh
// salt, the value itself in the vault.
export async function profile(input: Profile, deps: Deps): Promise<Outcome<(typeof ops)[typeof op], Profiled>> {
  const fields = columns.filter((c) => input[c] !== undefined)
  return write(deps, {
    op,
    request: input,
    state: async (tx) => {
      if (fields.length) {
        const sets = fields.map((c, i) => `${c} = $${i + 2}`).join(', ')
        await tx.query(`UPDATE member.member SET ${sets} WHERE address = $1`, [input.member, ...fields.map((c) => input[c])])
      }
      return { member: input.member, fields: [...fields] }
    },
    payload: (v) => ({
      member: v.member,
      fields: [...v.fields],
      values: Object.fromEntries(fields.map((c) => [c, personal(`member.member.${c}`, input.member, input[c] ?? null)])),
    }),
  })
}
