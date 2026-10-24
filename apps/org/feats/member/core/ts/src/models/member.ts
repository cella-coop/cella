export type Status = 'invited' | 'active' | 'suspended' | 'exited'

// Admission cites the decision that admits; the decision-member graft's
// rule resolves it, so this feat holds it as an id.
export interface Admit {
  member: string
  shares: number
  decision: string
}

export interface Admitted {
  member: string
  since: string
}
