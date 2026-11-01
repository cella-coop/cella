// What a motion asks of a member: to admit them, with the shares they
// subscribe, to suspend them or to end their membership.
export type Kind = 'admit' | 'suspend' | 'exit'

export interface Asked {
  id: string
  motion: string
  kind: Kind
  member: string
  name: string | null
  shares: number | null
}

// The members a motion's discussion names, its authors and those its
// messages mention, by the handle or address each gives.
export type People = Record<string, { address: string; name: string }>

// The graft's data on a motion's page.
export interface OnMotion {
  asked: Asked[]
  people: People
}

// How each kind reads on a motion's page, and on the member's.
export const verbs: Record<Kind, string> = { admit: 'admits', suspend: 'suspends', exit: 'ends the membership of' }
