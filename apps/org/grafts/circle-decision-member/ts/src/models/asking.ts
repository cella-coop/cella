// What a member's or a circle's page proposes: a membership admitted,
// suspended or ended, or a seat given or ended, each a motion of the
// graft that carries it out.
export type Asked = 'admit' | 'suspend' | 'exit' | 'seat' | 'unseat'

export interface Asking {
  kind: Asked
  args: Record<string, string | number>
  deadline: string
  body: string
}

// The circle a proposal goes to.
export interface Decider {
  id: string
  name: string
  procedure: 'consent' | 'majority'
}

// On a member's page: what may be proposed of their membership, as it
// stands, and the open decisions about them.
export interface Standing {
  member: string
  status: 'invited' | 'active' | 'suspended' | 'exited'
  decider: Decider
  open: { decision: string; title: string; deadline: string }[]
}

// On a circle's page: whom a decision may seat in it and in which role,
// the seats held that one may end, and the circle that decides.
export interface Appointing {
  circle: string
  decider: Decider
  members: { id: string; name: string }[]
  roles: { id: string; name: string }[]
  seats: { id: string; label: string; member: string; role: string | null }[]
}
