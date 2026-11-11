import type { Db } from '@cella/org-db'
import type { Path } from '../models/path.ts'

const columns = `p.address, p.name, p.stage, to_char(p.hired, 'YYYY-MM-DD') AS hired, to_char(p.left, 'YYYY-MM-DD') AS left,
  to_char(p.probation, 'YYYY-MM-DD') AS probation, to_char(p.probation_end, 'YYYY-MM-DD') AS "probationEnd", p.pledged,
  to_char(p.invited, 'YYYY-MM-DD') AS invited, to_char(p.applied, 'YYYY-MM-DD') AS applied, to_char(p.admitted, 'YYYY-MM-DD') AS admitted, to_char(p.exited, 'YYYY-MM-DD') AS exited,
  (p.stage IN ('candidate', 'invited') AND p.probation_end < cella.verdict_date()) AS due, coalesce(p.left < cella.verdict_date(), false) AS ended`

// Someone's path to membership, by their address, worker or member.
export async function path(db: Db, address: string): Promise<Path | null> {
  const { rows } = await db.query<Path>(`SELECT ${columns} FROM employment_membership.path p WHERE p.address = $1`, [address])
  return rows[0] ?? null
}

// Each worker's stage, by their address.
export const stages = `SELECT p.address AS id, p.stage, (p.stage IN ('candidate', 'invited') AND p.probation_end < cella.verdict_date()) AS due
  FROM employment_membership.path p WHERE p.hired IS NOT NULL`
