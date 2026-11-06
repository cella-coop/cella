export const states = ['open', 'submitted', 'approved'] as const
export type State = (typeof states)[number]

// An entry, with where its period stands.
export interface Entry {
  id: string
  // The circle its time is worked for, whose month it is in.
  circle: string
  member: string
  day: string
  // The month of its period, `YYYY-MM`, in its circle.
  month: string
  hours: number
  billable: boolean
  note: string
  state: State
}

// An entry as the collection lists it: its kind as its badge shows it,
// and its note or, without one, its hours.
export interface Listed extends Omit<Entry, 'billable'> {
  billable: 'billable' | 'internal'
}

// A member's month in a circle: its hours and where it stands.
export interface Sheet {
  circle: string
  member: string
  month: string
  hours: number
  billable: number
  entries: number
  submitted: string | null
  approved: string | null
  approver: string | null
  state: State
}

// An entry's page: the entry, and its member's month.
export interface Detail extends Entry {
  sheet: Sheet
}

// Time is written in whole minutes: a signed request holds integers only.
export interface Log {
  member: string
  day: string
  minutes: number
  billable: boolean
  note?: string
  // The circle the time is worked for, its owning circle; the root's where
  // none is named. The entry goes into its member's month of that circle.
  circle?: string
}

export interface Logged {
  entry: string
  circle: string
  member: string
  day: string
  minutes: number
  billable: boolean
}

// A correction names the entry and the whole minutes it comes down to:
// none, where the time was never worked.
export interface Correct {
  entry: string
  minutes: number
}

export interface Corrected extends Correct {
  // Whose entry it is and its day; none where there is no such entry.
  member: string | null
  day: string | null
}

// A member's month in a circle, its owning circle, which the guard reads
// a mandate's scope against: each circle's month is submitted and
// approved apart.
export interface Period {
  member: string
  month: string
  circle: string
}

export interface Submitted extends Period {
  submitted: string
}

export interface Approved extends Period {
  approved: string
}
