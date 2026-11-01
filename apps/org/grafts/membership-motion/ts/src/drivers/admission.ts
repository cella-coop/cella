import type { Db } from '@cella/org-db'
import type { Asked, People } from '../models/admission.ts'

// What motions ask of members, by motion or by member.
export async function asked(db: Db, by: { motion?: string; member?: string }): Promise<Asked[]> {
  const { rows } = await db.query<Asked>(
    `SELECT a.motion || '/' || a.n AS id, a.motion, a.kind, a.member, mp.name, a.shares
     FROM membership_motion.action a LEFT JOIN (membership.member m JOIN person.person mp ON mp.address = m.address) ON m.address = a.member
     WHERE ($1::text IS NULL OR a.motion = $1) AND ($2::text IS NULL OR a.member = $2)
     ORDER BY a.motion, a.n`,
    [by.motion ?? null, by.member ?? null],
  )
  return rows
}

// The members a motion's discussion names, by the reference each
// message gives: its author's address, and each handle it mentions that
// names one member.
export async function people(db: Db, motion: string): Promise<People> {
  const { rows } = await db.query<{ ref: string; address: string; name: string }>(
    `SELECT x.ref, m.address, mp.name
     FROM (
       SELECT member AS ref, member AS address FROM motion.message WHERE motion = $1
       UNION
       SELECT handle, member FROM membership_motion.mention WHERE motion = $1 AND member IS NOT NULL
     ) x
     JOIN (membership.member m JOIN person.person mp ON mp.address = m.address) ON m.address = x.address`,
    [motion],
  )
  return Object.fromEntries(rows.map((r) => [r.ref, { address: r.address, name: r.name }]))
}
