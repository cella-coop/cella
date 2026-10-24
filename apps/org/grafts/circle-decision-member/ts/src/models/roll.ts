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

// How the outcome reads: passing or not while open, passed or failed once
// closed.
export function outcome(r: Roll): { text: string; tone: Tone } {
  if (r.passes === null) {
    return { text: 'no stance counts', tone: 'neutral' }
  }
  const verb = r.closed ? (r.passes ? 'passed' : 'failed') : r.passes ? 'passes' : 'does not pass'
  return { text: `${verb} by ${r.rule}`, tone: r.passes ? 'positive' : 'negative' }
}

// A decision's electorate and its outcome, computed by
// `circle_decision_member.passes` from the stances on its roll; null while
// no stance counts.
export interface Roll {
  rule: 'consent' | 'majority'
  closed: string | null
  passes: boolean | null
  voters: Voter[]
}
