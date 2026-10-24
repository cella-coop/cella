export type Stance = 'for' | 'against' | 'abstain' | 'consent' | 'object'

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
