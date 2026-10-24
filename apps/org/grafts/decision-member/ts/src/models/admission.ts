// What a decision asks of a member: to admit them, with the shares they
// subscribe, to suspend them or to end their membership.
export type Kind = 'admit' | 'suspend' | 'exit'

export interface Asked {
  id: string
  decision: string
  kind: Kind
  member: string
  name: string | null
  shares: number | null
}

// How each kind reads on a decision's page, and on the member's.
export const verbs: Record<Kind, string> = { admit: 'admits', suspend: 'suspends', exit: 'ends the membership of' }
