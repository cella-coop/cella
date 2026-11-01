import type { Db } from '@cella/org-db'
import type { Approval } from '../models/approval.ts'

const columns = `a.distribution AS id, a.distribution, l.year, a.motion, d.title, to_char(d.closed, 'YYYY-MM-DD') AS closed,
  to_char(l.approved, 'YYYY-MM-DD') AS approved`
const from = `FROM motion_patronage.approval a
  JOIN patronage.distribution l ON l.id = a.distribution
  JOIN motion.motion d ON d.id = a.motion`

// The motions approving a distribution, or the distributions a motion
// approves.
export async function approvals(db: Db, by: { distribution: string } | { motion: string }): Promise<Approval[]> {
  const [where, value] = 'distribution' in by ? ['a.distribution', by.distribution] : ['a.motion', by.motion]
  const { rows } = await db.query<Approval>(`SELECT ${columns} ${from} WHERE ${where} = $1 ORDER BY l.year DESC, d.proposed DESC, d.id DESC`, [value])
  return rows
}

// The drafted distributions a new motion may move to approve, as its
// New form offers them.
export async function drafts(db: Db): Promise<{ value: string; label: string }[]> {
  const { rows } = await db.query<{ value: string; label: string }>(
    `SELECT l.id AS value, l.year || ' distribution' AS label FROM patronage.distribution l WHERE l.approved IS NULL ORDER BY l.year`,
  )
  return rows
}
