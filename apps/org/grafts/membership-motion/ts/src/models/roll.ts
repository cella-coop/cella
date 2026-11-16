import type { Shown } from './changes.ts'

// A member on a motion's roll, their latest stance received before its
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

// A motion's state, as the database reads it from its close and the
// stances the close froze: open, passed or rejected. One closed while no
// stance counted is rejected.
export const states = ['open', 'passed', 'rejected'] as const
export type State = (typeof states)[number]

// How the outcome reads: passing or not while open, passed or rejected
// once closed, by its procedure and short of its quorum if it is; or,
// `short`, as the drawer has it, the verdict alone.
export function outcome(r: Roll, short = false): { text: string; tone: Tone } {
  if (sealed(r)) {
    return { text: 'sealed until the close', tone: 'neutral' }
  }
  if (r.passes === null) {
    return { text: 'no stance counts', tone: 'neutral' }
  }
  const verb = r.closed ? (r.passes ? 'passed' : 'rejected') : r.passes ? 'passes' : 'does not pass'
  const by = short ? '' : ` by ${r.procedure.toLowerCase()}`
  const quorum = short || r.turnout.quorate ? '' : ', short of its quorum'
  return { text: `${verb}${by}${quorum}`, tone: r.passes ? 'positive' : 'negative' }
}

// Whether a secret ballot's tally is still sealed: it opens at the close.
export const sealed = (r: Roll): boolean => r.secret && !r.closed

// How many took part, of those counted, and the quorum: "7 of 10, quorum 1
// in 4"; sealed on a secret ballot until its close.
export function taking(r: Roll): string {
  if (sealed(r)) {
    return 'sealed until the close'
  }
  const [n, d] = r.turnout.quorum
  return n ? `${r.turnout.given} of ${r.turnout.counted}, quorum ${n === d ? 'all' : `${n} in ${d}`}` : `${r.turnout.given} of ${r.turnout.counted}`
}

// A motion's electorate and its outcome, computed by
// `motion.passes` from the stances on its roll; null while
// no stance counts.
export interface Roll {
  method: 'consent' | 'majority'
  // The label of the procedure it is taken by.
  procedure: string
  // Those who count on it, how many of them gave a stance, and whether
  // that meets its procedure's quorum, `[num, den]` of those counted;
  // null on a secret ballot until its close.
  turnout: { counted: number | null; given: number | null; quorate: boolean | null; quorum: [number, number] }
  // Whether it is taken by secret ballot: no stance but the acting
  // member's is read, and the tally is sealed until the close.
  secret: boolean
  closed: string | null
  passes: boolean | null
  state: State
  // The stances the method counts, which the stance form offers.
  stances: string[]
  // The acting member, if any: on the roll or not, and their latest
  // stance by receipt, the counted one once closed.
  me: { address: string; seated: boolean; stance: { stance: string; receipt: number; at: string } | null } | null
  voters: Voter[]
  // What its actions change, each as its diff shows it, of the kinds this
  // graft carries out (`changes`).
  changes?: Shown[]
}
