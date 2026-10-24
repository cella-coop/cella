export type Status = 'scheduled' | 'held' | 'cancelled'

// A meeting as the collection lists it: `at` is the scope's wall-clock
// time, `YYYY-MM-DDTHH:MM`; `length` the agenda's minutes, summed.
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

export interface Added {
  meeting: string
  item: number
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
  status: Status
  settled: string
}

export interface Minute {
  meeting: string
}

export interface Minuted {
  meeting: string
  minuted: string
}
