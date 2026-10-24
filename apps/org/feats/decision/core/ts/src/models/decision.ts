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
