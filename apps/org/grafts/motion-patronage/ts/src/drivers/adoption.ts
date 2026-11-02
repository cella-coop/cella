import type { Db } from '@cella/org-db'
import type { Adoption } from '../models/adoption.ts'

const columns = `t.id AS terms, t.policy, t."from", p.motion, d.title, to_char(d.closed, 'YYYY-MM-DD') AS closed,
  to_char(t.adopted, 'YYYY-MM-DD') AS adopted`
const from = `FROM patronage.terms t
  JOIN policy.policy p ON p.id = t.policy
  JOIN motion.motion d ON d.id = p.motion`

// The motion that adopted the rule terms copy, or the terms a motion's
// rules made.
export async function adoptions(db: Db, by: { terms: string } | { motion: string }): Promise<Adoption[]> {
  const [where, value] = 'terms' in by ? ['t.id', by.terms] : ['p.motion', by.motion]
  const { rows } = await db.query<Adoption>(`SELECT ${columns} ${from} WHERE ${where} = $1 ORDER BY t."from" DESC`, [value])
  return rows
}
