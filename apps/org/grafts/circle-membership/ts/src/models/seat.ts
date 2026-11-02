// A seat as the graft reads it, with its circle's, member's and role's
// names.
export interface Seat {
  id: string
  circle: string
  circleName: string
  member: string
  memberName: string
  role: string | null
  roleName: string | null
  since: string | null
  until: string | null
  // How the seat's circle decides, and whether it is the scope's root,
  // the assembly.
  procedure: string
  root: boolean
}

// A person's place in one circle, however many seats they hold in it:
// the roles they hold or held, since their first seat, and until their
// last one ended, or open while one is held.
export interface Sitting {
  id: string
  member: string
  roles: string | null
  since: string | null
  until: string | null
}

// A circle's seats as its people: one row each, in the order of their
// first seat, so a member holding three roles is listed once.
export function sittings(seats: Seat[]): Sitting[] {
  const by = new Map<string, Seat[]>()
  for (const s of seats) {
    by.set(s.member, [...(by.get(s.member) ?? []), s])
  }
  return [...by.entries()].map(([member, held]) => {
    const roles = [...new Set(held.map((s) => s.roleName).filter((r): r is string => r !== null))]
    const since = held.map((s) => s.since).filter((d): d is string => d !== null).sort()[0] ?? null
    const ended = held.map((s) => s.until)
    return {
      id: member,
      member,
      roles: roles.length ? roles.join(', ') : null,
      since,
      until: ended.includes(null) ? null : (ended.sort().at(-1) ?? null),
    }
  })
}

// A mandate a member holds through a seat they hold, the policy that
// grants it and its sentence as it reads; amounts in cents.
export interface Held {
  id: string
  power: string
  policy: string
  sentence: string
  limit: number | null
  role: string
  circle: string
  circleName: string
}

// A seat to add: a member in a circle, in a role or as a plain member, and
// the motion that seats them, which the write cites.
export interface Add {
  circle: string
  member: string
  role: string | null
  motion: string
}

export interface Added {
  seat: number
  since: string
}

// A seat to end, named as it was added, and the motion that ends it.
export type Remove = Add

export interface Removed {
  seat: number
  until: string
}
