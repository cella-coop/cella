// A member on a decision's roll, their latest stance received before its
// cutoff, and whether the close counted them.
export interface Voter {
  id: string
  member: string
  name: string | null
  stance: string | null
  receipt: number | null
  counted: boolean
}

export type Tone = 'neutral' | 'positive' | 'negative'

// A decision's state, as the database reads it from its close and the
// stances the close froze: open, passed or rejected. One closed while no
// stance counted is rejected.
export const states = ['open', 'passed', 'rejected'] as const
export type State = (typeof states)[number]

// How the outcome reads: passing or not while open, passed or failed once
// closed, by its procedure; short of its quorum, said so.
export function outcome(r: Roll): { text: string; tone: Tone } {
  if (r.passes === null) {
    return { text: 'no stance counts', tone: 'neutral' }
  }
  const verb = r.closed ? (r.passes ? 'passed' : 'rejected') : r.passes ? 'passes' : 'does not pass'
  const short = r.turnout.quorate ? '' : ', short of its quorum'
  return { text: `${verb} by ${r.procedure.toLowerCase()}${short}`, tone: r.passes ? 'positive' : 'negative' }
}

// How many took part, of those counted, and the quorum: "7 of 10, quorum 1 in 4".
export function taking(r: Roll): string {
  const [n, d] = r.turnout.quorum
  return n ? `${r.turnout.given} of ${r.turnout.counted}, quorum ${n === d ? 'all' : `${n} in ${d}`}` : `${r.turnout.given} of ${r.turnout.counted}`
}

// A decision's electorate and its outcome, computed by
// `circle_decision_member.passes` from the stances on its roll; null while
// no stance counts.
export interface Roll {
  rule: 'consent' | 'majority'
  // The label of the procedure it is taken by.
  procedure: string
  // Those who count on it, how many of them gave a stance, and whether
  // that meets its procedure's quorum, `[num, den]` of those counted.
  turnout: { counted: number; given: number; quorate: boolean; quorum: [number, number] }
  closed: string | null
  passes: boolean | null
  state: State
  // The stances the rule counts, which the stance form offers.
  stances: string[]
  // The acting member, if any: on the roll or not, and their latest
  // stance by receipt, the counted one once closed.
  me: { address: string; seated: boolean; stance: { stance: string; receipt: number; at: string } | null } | null
  voters: Voter[]
}
