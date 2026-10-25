import type { Db } from '@cella/org-db'
import type { Path, Stage } from '../models/path.ts'

const columns = `p.address, p.name, p.stage, to_char(p.hired, 'YYYY-MM-DD') AS hired, to_char(p.left, 'YYYY-MM-DD') AS left,
  to_char(p.probation, 'YYYY-MM-DD') AS probation, to_char(p.probation_end, 'YYYY-MM-DD') AS "probationEnd", p.pledged,
  to_char(p.invited, 'YYYY-MM-DD') AS invited, to_char(p.admitted, 'YYYY-MM-DD') AS admitted, to_char(p.exited, 'YYYY-MM-DD') AS exited,
  (p.stage IN ('candidate', 'invited') AND p.probation_end < cella.verdict_date()) AS due, coalesce(p.left < cella.verdict_date(), false) AS ended,
  to_char(greatest(p.hired, cella.verdict_date()), 'YYYY-MM-DD') AS today`

// Someone's path to membership, by their address, worker or member.
export async function path(db: Db, address: string): Promise<Path | null> {
  const { rows } = await db.query<Path>(`SELECT ${columns} FROM employment_membership.path p WHERE p.address = $1`, [address])
  return rows[0] ?? null
}

// Each worker's stage, by their address.
export async function stages(db: Db): Promise<Record<string, { stage: Stage; due: boolean }>> {
  const { rows } = await db.query<{ address: string; stage: Stage; due: boolean }>(
    `SELECT p.address, p.stage, (p.stage IN ('candidate', 'invited') AND p.probation_end < cella.verdict_date()) AS due
     FROM employment_membership.path p WHERE p.hired IS NOT NULL`,
  )
  return Object.fromEntries(rows.map((r) => [r.address, { stage: r.stage, due: r.due }]))
}
