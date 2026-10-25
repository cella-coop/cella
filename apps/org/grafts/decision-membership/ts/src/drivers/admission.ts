import type { Db } from '@cella/org-db'
import type { Asked, People } from '../models/admission.ts'

// What decisions ask of members, by decision or by member.
export async function asked(db: Db, by: { decision?: string; member?: string }): Promise<Asked[]> {
  const { rows } = await db.query<Asked>(
    `SELECT a.decision || '/' || a.n AS id, a.decision, a.kind, a.member, mp.name, a.shares
     FROM decision_membership.motion a LEFT JOIN (membership.member m JOIN person.person mp ON mp.address = m.address) ON m.address = a.member
     WHERE ($1::text IS NULL OR a.decision = $1) AND ($2::text IS NULL OR a.member = $2)
     ORDER BY a.decision, a.n`,
    [by.decision ?? null, by.member ?? null],
  )
  return rows
}

// The members a decision's discussion names, by the reference each
// message gives: its author's address, and each handle it mentions that
// names one member.
export async function people(db: Db, decision: string): Promise<People> {
  const { rows } = await db.query<{ ref: string; address: string; name: string }>(
    `SELECT x.ref, m.address, mp.name
     FROM (
       SELECT member AS ref, member AS address FROM decision.message WHERE decision = $1
       UNION
       SELECT handle, member FROM decision_membership.mention WHERE decision = $1 AND member IS NOT NULL
     ) x
     JOIN (membership.member m JOIN person.person mp ON mp.address = m.address) ON m.address = x.address`,
    [decision],
  )
  return Object.fromEntries(rows.map((r) => [r.ref, { address: r.address, name: r.name }]))
}
