import { done, type Deps, type Done } from '@cella/org-db'
import { adopt } from '@cella/org-patronage/api'

// What follows a policy's adoption: a rule marking a value of the
// patronage feat's is the work share's terms, copied into them by the
// patronage feat's write, a write of its own signed by whoever signed the
// adoption and citing the motion that adopted it. Any other policy is
// copied nothing, and no write is made.
export async function adopted(request: unknown, deps: Deps): Promise<Done[]> {
  const { motion, n } = request as { motion: string; n: number }
  const policy = `${motion}/${n}`
  const { rows } = await deps.db.query<{ reads: boolean }>(
    `SELECT patronage.reads(patronage.marked_by(p.id)) AS reads FROM policy.policy p WHERE p.id = $1 AND p.kind = 'rule'`,
    [policy],
  )
  if (!rows[0]?.reads) {
    return []
  }
  const input = { policy, motion }
  return [done('patronage:terms:adopt', await adopt(input, deps))]
}
