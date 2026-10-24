import type { Db } from '@cella/org-db'
import type { Roll, Voter } from '../models/roll.ts'

// A decision's roll, each member's latest stance before its cutoff, and
// whether it passes, as the database computes it.
export async function roll(db: Db, decision: string): Promise<Roll | null> {
  const found = await db.query<{ rule: Roll['rule']; closed: string | null; passes: boolean | null }>(
    `SELECT rule, to_char(closed, 'YYYY-MM-DD') AS closed, circle_decision_member.passes(id) AS passes
     FROM decision.decision WHERE id = $1`,
    [decision],
  )
  const d = found.rows[0]
  if (!d) {
    return null
  }
  const voters = await db.query<Voter>(
    `SELECT r.member AS id, r.member, m.name, v.stance, v.receipt::int AS receipt,
            EXISTS (SELECT FROM circle_decision_member.counted c WHERE c.decision = r.decision AND c.member = r.member) AS counted
     FROM circle_decision_member.roll r
     JOIN decision.decision d ON d.id = r.decision
     LEFT JOIN member.member m ON m.address = r.member
     LEFT JOIN LATERAL (
       SELECT stance, receipt FROM decision.vote x
       WHERE x.decision = r.decision AND x.member = r.member AND x.receipt < coalesce(d.cutoff, 9223372036854775807)
       ORDER BY x.receipt DESC LIMIT 1
     ) v ON true
     WHERE r.decision = $1
     ORDER BY m.name`,
    [decision],
  )
  return { ...d, voters: voters.rows }
}

// How many on each decision's roll have given a stance, by decision.
export async function turnout(db: Db): Promise<Record<string, { turnout: string }>> {
  const { rows } = await db.query<{ decision: string; given: number; roll: number }>(
    `SELECT r.decision, count(*)::int AS roll,
            count(*) FILTER (WHERE EXISTS (SELECT FROM decision.vote v WHERE v.decision = r.decision AND v.member = r.member))::int AS given
     FROM circle_decision_member.roll r GROUP BY r.decision`,
  )
  return Object.fromEntries(rows.map((r) => [r.decision, { turnout: `${r.given} of ${r.roll}` }]))
}
