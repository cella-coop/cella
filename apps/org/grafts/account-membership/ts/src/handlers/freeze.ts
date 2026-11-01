import { done, type Deps, type Done } from '@cella/org-db'
import { freeze } from '@cella/org-account/api'

// What follows an exit: the member's capital accounts frozen, by the
// account feat's freeze, a write of its own signed by whoever signed the
// exit and citing the motion that ended the membership. A member who
// holds no account is frozen nothing, and no write is made.
export async function frozen(request: unknown, deps: Deps): Promise<Done[]> {
  const { member, motion } = request as { member: string; motion: string }
  const { rows } = await deps.db.query<{ unfrozen: boolean }>('SELECT account_membership.unfrozen($1) AS unfrozen', [member])
  if (!rows[0]?.unfrozen) {
    return []
  }
  const input = { holder: member, motion }
  return [done('account:account:freeze', await freeze(input, deps), [], input)]
}
