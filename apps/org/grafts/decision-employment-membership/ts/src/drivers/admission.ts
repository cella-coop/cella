import type { Db } from '@cella/org-db'
import type { Admission } from '../models/admission.ts'

// A candidate's admission, by their address; null for anyone who is not
// one, a member or an employee with no candidacy.
export async function admission(db: Db, address: string): Promise<Admission | null> {
  const { rows } = await db.query<Admission>(
    `SELECT a.address, a.name, a.stage, to_char(a.probation_end, 'YYYY-MM-DD') AS "probationEnd",
            a.probation_end < cella.verdict_date() AS ended, a.pledged, a.decision, a.title,
            to_char(a.deadline, 'YYYY-MM-DD') AS deadline, to_char(a.closed, 'YYYY-MM-DD') AS closed, a.due,
            to_char(cella.verdict_date() + 14, 'YYYY-MM-DD') AS until,
            a.name || ' has worked with the co-op since ' || to_char(a.hired, 'FMDD FMMonth YYYY')
              || ', and their probation as a candidate ended on ' || to_char(a.probation_end, 'FMDD FMMonth YYYY')
              || '. They subscribe the ' || a.pledged || ' shares they pledged.' AS why
     FROM decision_employment_membership.admission a WHERE a.address = $1`,
    [address],
  )
  return rows[0] ?? null
}
