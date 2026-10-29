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
  const { rows } = await db.query<Approval>(`SELECT ${columns} ${from} WHERE ${where} = $1 ORDER BY l.year DESC, d.proposed DESC, d.id DESC`, [value])
  return rows
}

// The drafted distributions a new decision may move to approve, as its
// New form offers them.
export async function drafts(db: Db): Promise<{ value: string; label: string }[]> {
  const { rows } = await db.query<{ value: string; label: string }>(
    `SELECT l.id AS value, l.year || ' distribution' AS label FROM patronage.distribution l WHERE l.approved IS NULL ORDER BY l.year`,
  )
  return rows
}
