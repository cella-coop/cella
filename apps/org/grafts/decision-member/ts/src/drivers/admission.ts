import type { Db } from '@cella/org-db'
import type { Asked } from '../models/admission.ts'

// What decisions ask of members, by decision or by member.
export async function asked(db: Db, by: { decision?: string; member?: string }): Promise<Asked[]> {
  const { rows } = await db.query<Asked>(
    `SELECT a.decision || '/' || a.n AS id, a.decision, a.kind, a.member, m.name, a.shares
     FROM decision_member.motion a LEFT JOIN member.member m ON m.address = a.member
     WHERE ($1::text IS NULL OR a.decision = $1) AND ($2::text IS NULL OR a.member = $2)
     ORDER BY a.decision, a.n`,
    [by.decision ?? null, by.member ?? null],
  )
  return rows
}
