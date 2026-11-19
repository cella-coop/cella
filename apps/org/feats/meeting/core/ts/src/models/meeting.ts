import type { status } from './status.ts'

export type Status = (typeof status.states)[number]['value']

// A meeting as the collection lists it: `at` is the scope's wall-clock
// time, `YYYY-MM-DDTHH:MM`; `length` the agenda's minutes, summed. In the
// list, the place is "online" where there is only a link, and an agenda
// without minutes has no length.
export interface Meeting {
  id: string
  circle: string
  title: string
  at: string
  place: string
  link: string | null
  status: Status
  settled: string | null
  minuted: string | null
  items: number
  length: number
}

// An item of the agenda, in its order.
export interface Item {
  // Its id as text, a row's key.
  id: string
  n: number
  title: string
  presenter: string
  minutes: number | null
}

export interface Detail extends Meeting {
  scheduled: string | null
  agenda: Item[]
}

// What a new meeting may be put in: the circles meetings already name.
export interface Offered {
  circles: string[]
}

export interface Schedule {
  circle: string
  title: string
  // An ISO day and an `HH:MM` time, the scope's wall clock.
  day: string
  time: string
  place?: string
  link?: string
}

export interface Scheduled {
  meeting: string
  circle: string
  at: string
}

export interface Add {
  meeting: string
  title: string
  presenter?: string
  minutes?: number
}

// The item as it was added, at the end of the agenda.
export interface Added {
  meeting: string
  item: number
  pos: number
  title: string
  presenter: string
  minutes: number | null
}

// Moves an item to an index of the agenda as the mover read it.
export interface Move {
  meeting: string
  item: number
  to: number
}

export interface Moved {
  meeting: string
  item: number
  pos: number
}

export interface Remove {
  meeting: string
  item: number
}

export interface Removed {
  meeting: string
  item: number
}

export interface Settle {
  meeting: string
}

export interface Settled {
  meeting: string
  // Its owning circle, which the guard reads a mandate's scope against.
  circle: string
  status: Status
  settled: string
}

export interface Minute {
  meeting: string
}

export interface Minuted {
  meeting: string
  circle: string
  minuted: string
}
