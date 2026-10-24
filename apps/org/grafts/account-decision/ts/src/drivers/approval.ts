import type { Db } from '@cella/org-db'
import type { Approval } from '../models/approval.ts'

const columns = `a.allocation AS id, a.allocation, l.year, a.decision, d.title, to_char(d.closed, 'YYYY-MM-DD') AS closed,
  to_char(l.allocated, 'YYYY-MM-DD') AS allocated`
const from = `FROM account_decision.approval a
  JOIN account.allocation l ON l.id = a.allocation
  JOIN decision.decision d ON d.id = a.decision`

// The decisions approving an allocation, or the allocations a decision
// approves.
export async function approvals(db: Db, by: { allocation: string } | { decision: string }): Promise<Approval[]> {
  const [where, value] = 'allocation' in by ? ['a.allocation', by.allocation] : ['a.decision', by.decision]
  const { rows } = await db.query<Approval>(`SELECT ${columns} ${from} WHERE ${where} = $1 ORDER BY l.year DESC`, [value])
  return rows
}
