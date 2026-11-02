import { done, type Deps, type Done } from '@cella/org-db'
import { adopt } from '@cella/org-account/api'

// What follows a policy's adoption: a rule marking a value of the account
// feat's is the capital's terms, copied into them by the account feat's
// write, a write of its own signed by whoever signed the adoption and
// citing the motion that adopted it. Any other policy is copied nothing,
// and no write is made.
export async function adopted(request: unknown, deps: Deps): Promise<Done[]> {
  const { motion, n } = request as { motion: string; n: number }
  const policy = `${motion}/${n}`
  const { rows } = await deps.db.query<{ reads: boolean }>(
    `SELECT account.reads(account.marked_by(p.id)) AS reads FROM policy.policy p WHERE p.id = $1 AND p.kind = 'rule'`,
    [policy],
  )
  if (!rows[0]?.reads) {
    return []
  }
  const input = { policy, motion }
  return [done('account:terms:adopt', await adopt(input, deps), [], input)]
}
