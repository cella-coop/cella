import type { Db } from '@cella/org-db'
import type { Approval } from '../models/approval.ts'

const columns = `a.distribution AS id, a.distribution, l.year, a.decision, d.title, to_char(d.closed, 'YYYY-MM-DD') AS closed,
  to_char(l.approved, 'YYYY-MM-DD') AS approved`
const from = `FROM decision_patronage.approval a
  JOIN patronage.distribution l ON l.id = a.distribution
  JOIN decision.decision d ON d.id = a.decision`

// The decisions approving a distribution, or the distributions a decision
// approves.
export async function approvals(db: Db, by: { distribution: string } | { decision: string }): Promise<Approval[]> {
  const [where, value] = 'distribution' in by ? ['a.distribution', by.distribution] : ['a.decision', by.decision]
  const { rows } = await db.query<Approval>(`SELECT ${columns} ${from} WHERE ${where} = $1 ORDER BY l.year DESC`, [value])
  return rows
}
