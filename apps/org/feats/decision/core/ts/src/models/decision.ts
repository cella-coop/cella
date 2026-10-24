export type Stance = 'for' | 'against' | 'abstain' | 'consent' | 'object'

export type Rule = 'consent' | 'majority'

// The stances each rule counts.
export const stances: Record<Rule, Stance[]> = {
  consent: ['consent', 'object', 'abstain'],
  majority: ['for', 'against', 'abstain'],
}

// A decision as the feat reads it. Its outcome is never stored: the
// circle-decision-member graft computes it from the stances on its roll.
export interface Decision {
  id: string
  circle: string
  title: string
  rule: Rule
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
  given: Given[]
  motions: Motioned[]
}

// An argument a motion of a kind takes, as the New form asks for it.
export interface Arg {
  name: string
  label: string
  type: 'text' | 'number'
  optional?: boolean
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
}

// A proposal: a decision of a circle, by its rule, open until its
// deadline, and the motions it decides. Its id and the day it is proposed
// are the server's.
export interface Propose {
  circle: string
  title: string
  rule: Rule
  deadline: string
  body: string
  motions: Motion[]
}

export interface Proposed {
  decision: string
  proposed: string
}

// What the New form offers: the kinds of motion, and the circles a
// decision may be put in, which a graft joining circles adds.
export interface Offered {
  kinds: Kind[]
  circles?: { id: string; name: string; procedure: Rule }[]
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
