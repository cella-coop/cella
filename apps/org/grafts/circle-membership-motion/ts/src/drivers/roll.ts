import type { Db } from '@cella/org-db'
import { stances, type Stance } from '@cella/org-motion/models'
import type { Roll, Voter } from '../models/roll.ts'

// A motion's state, in SQL over `d`: open until its close, then passed
// or rejected as `circle_membership_motion.tally` reads the stances the
// close froze.
const state = `CASE WHEN d.closed IS NULL THEN 'open'
                    WHEN (circle_membership_motion.tally(d.id)).passes THEN 'passed'
                    ELSE 'rejected' END`

// A motion's roll, each member's latest stance before its cutoff, none
// on a secret ballot, whether it passes and its state, as the database
// computes them, sealed on a secret ballot until its close; and, for the
// acting member, whether they are on the roll and their latest stance by
// receipt, the one counted once the motion closed.
export async function roll(db: Db, motion: string, actor: string | null = null): Promise<Roll | null> {
  const found = await db.query<Omit<Roll, 'stances' | 'me' | 'voters'>>(
    `SELECT d.method, p.label AS procedure, to_char(d.closed, 'YYYY-MM-DD') AS closed,
            d.ballot = 'secret' AS secret, t.passes, ${state} AS state,
            json_build_object('counted', t.counted, 'given', t.given, 'quorate', t.quorate,
                              'quorum', json_build_array(p.quorum_num, p.quorum_den)) AS turnout
     FROM motion.motion d
     JOIN motion.procedure p ON p.id = d.procedure
     CROSS JOIN LATERAL circle_membership_motion.tally(d.id) t
     WHERE d.id = $1`,
    [motion],
  )
  const d = found.rows[0]
  if (!d) {
    return null
  }
  const voters = await db.query<Voter>(
    `SELECT r.member AS id, r.member, mp.name, v.stance, v.receipt::int AS receipt,
            EXISTS (SELECT FROM circle_membership_motion.counted c WHERE c.motion = r.motion AND c.member = r.member) AS counted
     FROM circle_membership_motion.roll r
     JOIN motion.motion d ON d.id = r.motion
     LEFT JOIN (membership.member m JOIN person.person mp ON mp.address = m.address) ON m.address = r.member
     LEFT JOIN LATERAL (
       SELECT stance, receipt FROM motion.vote x
       WHERE x.motion = r.motion AND x.member = r.member AND x.receipt < coalesce(d.cutoff, 9223372036854775807)
         AND d.ballot = 'open'
       ORDER BY x.receipt DESC LIMIT 1
     ) v ON true
     WHERE r.motion = $1
     ORDER BY mp.name`,
    [motion],
  )
  const mine = actor
    ? await db.query<{ stance: Stance; receipt: number; at: string }>(
        `SELECT v.stance, v.receipt::int AS receipt, to_char(v.at, 'YYYY-MM-DD') AS at
         FROM motion.vote v JOIN motion.motion d ON d.id = v.motion
         WHERE v.motion = $1 AND v.member = $2 AND v.receipt < coalesce(d.cutoff, 9223372036854775807)
         ORDER BY v.receipt DESC LIMIT 1`,
        [motion, actor],
      )
    : null
  const seated = actor
    ? (await db.query(`SELECT FROM circle_membership_motion.roll WHERE motion = $1 AND member = $2`, [motion, actor])).rowCount
    : 0
  return {
    ...d,
    voters: voters.rows,
    stances: stances[d.method],
    me: actor ? { address: actor, seated: !!seated, stance: mine?.rows[0] ?? null } : null,
  }
}

// Each motion's state, and how many on its roll have given a stance,
// "4 of 10", by motion; none where it has no roll. A secret ballot's
// reads "sealed" until its close, then how many of those counted took
// part, from its tally.
export const turnout = `SELECT d.id, ${state} AS state,
    CASE WHEN d.ballot = 'open' THEN t.given || ' of ' || t.roll
         WHEN d.closed IS NULL THEN 'sealed'
         ELSE x.given || ' of ' || x.counted END AS turnout
  FROM motion.motion d
  LEFT JOIN (
    SELECT r.motion, count(*)::int AS roll,
           count(*) FILTER (WHERE EXISTS (SELECT FROM motion.vote v WHERE v.motion = r.motion AND v.member = r.member))::int AS given
    FROM circle_membership_motion.roll r GROUP BY r.motion
  ) t ON t.motion = d.id
  LEFT JOIN LATERAL (
    SELECT s.given, s.counted FROM circle_membership_motion.tally(d.id) s WHERE d.ballot = 'secret' AND d.closed IS NOT NULL
  ) x ON true`
