import type { Db } from '@cella/org-db'
import type { Roll, State, Voter } from '../models/roll.ts'

// A decision's state, in SQL over `d`: open until its close, then passed
// or rejected as `circle_decision_member.passes` reads the stances the
// close froze.
const state = `CASE WHEN d.closed IS NULL THEN 'open'
                    WHEN circle_decision_member.passes(d.id) THEN 'passed'
                    ELSE 'rejected' END`

// A decision's roll, each member's latest stance before its cutoff,
// whether it passes and its state, as the database computes them.
export async function roll(db: Db, decision: string): Promise<Roll | null> {
  const found = await db.query<{ rule: Roll['rule']; closed: string | null; passes: boolean | null; state: State }>(
    `SELECT d.rule, to_char(d.closed, 'YYYY-MM-DD') AS closed, circle_decision_member.passes(d.id) AS passes, ${state} AS state
     FROM decision.decision d WHERE d.id = $1`,
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

// Each decision's state, and how many on its roll have given a stance,
// by decision.
export async function turnout(db: Db): Promise<Record<string, { turnout?: string; state: State }>> {
  const { rows } = await db.query<{ decision: string; state: State; given: number | null; roll: number | null }>(
    `SELECT d.id AS decision, ${state} AS state, t.roll, t.given
     FROM decision.decision d
     LEFT JOIN (
       SELECT r.decision, count(*)::int AS roll,
              count(*) FILTER (WHERE EXISTS (SELECT FROM decision.vote v WHERE v.decision = r.decision AND v.member = r.member))::int AS given
       FROM circle_decision_member.roll r GROUP BY r.decision
     ) t ON t.decision = d.id`,
  )
  return Object.fromEntries(rows.map((r) => [r.decision, { state: r.state, ...(r.roll === null ? {} : { turnout: `${r.given} of ${r.roll}` }) }]))
}
