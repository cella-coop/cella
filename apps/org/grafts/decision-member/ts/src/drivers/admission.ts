import type { Db } from '@cella/org-db'
import type { Admission } from '../models/admission.ts'

export async function admissions(db: Db, by: { decision?: string; member?: string }): Promise<Admission[]> {
  const { rows } = await db.query<Admission>(
    `SELECT a.decision || '/' || a.member AS id, a.decision, a.member, m.name, a.shares
     FROM decision_member.admission a LEFT JOIN member.member m ON m.address = a.member
     WHERE ($1::text IS NULL OR a.decision = $1) AND ($2::text IS NULL OR a.member = $2)
     ORDER BY a.decision, m.name`,
    [by.decision ?? null, by.member ?? null],
  )
  return rows
}
