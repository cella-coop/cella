import type { Message } from './thread.ts'

export type Stance = 'for' | 'against' | 'abstain' | 'consent' | 'object'

export type Rule = 'consent' | 'majority'

// The stances each rule counts.
export const stances: Record<Rule, Stance[]> = {
  consent: ['consent', 'object', 'abstain'],
  majority: ['for', 'against', 'abstain'],
}

// How a decision is taken: its rule; for a majority, the share of the
// votes cast it needs, at least `[num, den]` of those for and against, or
// none for more for than against; and its quorum, at least `[num, den]`
// of those counted giving a stance.
export interface Procedure {
  id: string
  label: string
  rule: Rule
  share: [number, number] | null
  quorum: [number, number]
}

const fraction = ([n, d]: [number, number]) => (n === d ? 'all' : `${n} in ${d}`)

// A procedure's terms in words: "consent", "majority, quorum 1 in 4",
// "2 in 3 of votes cast, quorum 1 in 2".
export function terms(p: Procedure): string {
  const rule = p.share ? `${fraction(p.share)} of votes cast` : p.rule
  return p.quorum[0] ? `${rule}, quorum ${fraction(p.quorum)}` : rule
}

// A decision as the feat reads it. Its outcome is never stored: the
// circle-decision-membership graft computes it from the stances on its roll.
export interface Decision {
  id: string
  circle: string
  title: string
  rule: Rule
  // The procedure it was proposed under, whose rule is its own.
  procedure: string
  proposed: string
  deadline: string
  closed: string | null
}

// A stance given, by its receipt; the member's latest counts.
export interface Given {
  id: string
  receipt: number
  member: string
  stance: Stance
  at: string
}

export interface Detail extends Decision {
  body: string
  cutoff: number | null
  // The terms of its procedure.
  terms: Procedure
  given: Given[]
  motions: Motioned[]
  // Its deliberation, in the order received.
  messages: Message[]
}

// An argument a motion of a kind takes, as the New form asks for it.
export interface Arg {
  name: string
  label: string
  type: 'text' | 'number'
  optional?: boolean
  // The key of a list of choices in the New form's `about`, which the
  // kind's graft adds, such as the versions a decision may adopt; the
  // form offers them instead of a text box.
  options?: string
}

// A decision as a card draws it, inside a document or a meeting's
// minutes: its title, circle and rule, and where it stands.
export interface Summary {
  id: string
  title: string
  circle: string
  rule: string
  deadline: string
  closed: string | null
}

// One of an argument's choices.
export interface Choice {
  value: string
  label: string
}

// A kind of thing a decision decides, registered by the graft that
// carries it out.
export interface Kind {
  kind: string
  label: string
  fields: Arg[]
}

// What a decision decides: a motion of a registered kind, its arguments
// as the kind names them.
export interface Motion {
  kind: string
  args: Record<string, string | number>
}

export interface Motioned extends Motion {
  id: string
  n: number
  label: string
  // Its kind's arguments, which name what its args hold.
  fields: Arg[]
}

// A proposal: a decision of a circle, by a procedure, open until its
// deadline, and the motions it decides. Its id, the day it is proposed and
// its rule, its procedure's, are the server's.
export interface Propose {
  circle: string
  title: string
  procedure: string
  deadline: string
  body: string
  motions: Motion[]
}

export interface Proposed {
  decision: string
  proposed: string
}

// What the New form offers: the kinds of motion, the procedures, and the
// circles a decision may be put in, each with the procedure it decides by,
// which a graft joining circles adds.
export interface Offered {
  kinds: Kind[]
  procedures: Procedure[]
  circles?: { id: string; name: string; procedure: string }[]
  // The lists of choices the kinds' arguments name, by key.
  [options: string]: unknown
}

export interface Vote {
  decision: string
  member: string
  stance: Stance
}

export interface Cast {
  receipt: number
}

export interface Close {
  decision: string
}

export interface Closed {
  decision: string
  closed: string
  cutoff: number
}
