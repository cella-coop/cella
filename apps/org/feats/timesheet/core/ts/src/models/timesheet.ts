export const states = ['open', 'submitted', 'approved'] as const
export type State = (typeof states)[number]

// An entry, with where its period stands.
export interface Entry {
  id: string
  member: string
  day: string
  // The month of its period, `YYYY-MM`.
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

// A member's month: its hours and where it stands.
export interface Sheet {
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
}

export interface Logged {
  entry: string
  member: string
  day: string
  minutes: number
  billable: boolean
}

export interface Period {
  member: string
  month: string
}

export interface Submitted extends Period {
  submitted: string
}

export interface Approved extends Period {
  approved: string
}
