export type Side = 'debit' | 'credit'

// One positive amount, in cents, on one side of one account, by its code;
// `person`, where the amount is a person's own figure, whose it is.
export interface Line {
  account: string
  side: Side
  cents: number
  person?: string
}

export interface Entry {
  // The accounting date, YYYY-MM-DD.
  date: string
  label: string
  lines: Line[]
}

// A payment to a supplier: the amount leaves the bank, 512, and settles
// what the co-op owes its suppliers, 401.
export interface Pay {
  date: string
  label: string
  cents: number
}

// A correcting entry names the entry it corrects and that entry's latest
// correction it read, or null if it read none.
export interface Adjust {
  corrects: string
  base: string | null
  entry: Entry
}

export interface Posted {
  entry: string
  receipt: number
}

// An entry as the journal lists it: what it moved, the sum of its debits,
// in cents.
export interface Journaled {
  id: string
  date: string
  label: string
  amount: number
  corrects: string | null
  receipt: number | null
}

export interface Booked {
  id: string
  n: number
  account: string
  side: Side
  cents: number
}

export interface Detail extends Journaled {
  lines: Booked[]
  corrected: string[]
}
