import type { Outcome } from '@cella/org-actions'
import { erasure, personal, write, type Deps } from '@cella/org-db'
import type { actions } from '../models/actions.ts'
import type { Forget, Profile, Profiled } from '../models/person.ts'

type Action = keyof typeof actions

// The fields a profile sets, in a fixed order; nothing else reaches SQL.
const columns = ['name', 'email', 'phone'] as const

// Sets the given fields of a person's profile. `person.own_profile`
// refuses anyone but the person; the log commits to each value under a
// fresh salt, the value itself in the vault.
export async function profile(input: Profile, deps: Deps): Promise<Outcome<(typeof actions)['person:person:profile'], Profiled>> {
  const fields = columns.filter((c) => input[c] !== undefined)
  return write(deps, {
    op: 'person:person:profile' satisfies Action,
    request: input,
    state: async (tx) => {
      if (fields.length) {
        const sets = fields.map((c, i) => `${c} = $${i + 2}`).join(', ')
        await tx.query(`UPDATE person.person SET ${sets} WHERE address = $1`, [input.person, ...fields.map((c) => input[c])])
      }
      return { person: input.person, fields: [...fields] }
    },
    payload: (v) => ({
      person: v.person,
      fields: [...v.fields],
      values: Object.fromEntries(fields.map((c) => [c, personal(`person.person.${c}`, input.person, input[c] ?? null)])),
    }),
  })
}

// A person erases their own contact details, which the notary deletes
// from the vault and redacts here; `person.forgets` refuses anyone else's.
export async function forget(input: Forget, deps: Deps): Promise<Outcome<(typeof actions)['person:person:forget'], { person: string }>> {
  return write(deps, {
    op: 'person:person:forget' satisfies Action,
    request: input,
    state: async () => ({ person: input.person }),
    payload: (v) => ({ person: v.person, erasure: erasure(v.person, ['contact']) }),
  })
}
