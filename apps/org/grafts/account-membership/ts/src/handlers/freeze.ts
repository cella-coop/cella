import { done, type Deps, type Done } from '@cella/org-db'
import { freeze, freezeOwn } from '@cella/org-account/api'

// Whether the member holds a capital account not yet frozen.
async function unfrozen(deps: Deps, member: string): Promise<boolean> {
  const { rows } = await deps.db.query<{ unfrozen: boolean }>('SELECT account_membership.unfrozen($1) AS unfrozen', [member])
  return Boolean(rows[0]?.unfrozen)
}

// What follows an exclusion: the member's capital accounts frozen, by the
// account feat's freeze, a write of its own signed by whoever signed the
// exclusion and citing the motion that excluded them. A member who holds
// no account is frozen nothing, and no write is made.
export async function frozen(request: unknown, deps: Deps): Promise<Done[]> {
  const { member, motion } = request as { member: string; motion: string }
  if (!(await unfrozen(deps, member))) {
    return []
  }
  const input = { holder: member, motion }
  return [done('account:account:freeze', await freeze(input, deps))]
}

// What follows a withdrawal: the same freeze as the member's own, signed
// by the member who withdrew, citing no motion.
export async function frozenOwn(request: unknown, deps: Deps): Promise<Done[]> {
  const { member } = request as { member: string }
  if (!(await unfrozen(deps, member))) {
    return []
  }
  const input = { holder: member }
  return [done('account:own:freeze', await freezeOwn(input, deps))]
}
