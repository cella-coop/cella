export interface Close {
  // YYYY-MM.
  month: string
}

export interface Closed {
  month: string
  closed: string
}

// Opening the month after the latest the books hold.
export interface OpenPeriod {
  // YYYY-MM.
  month: string
}

export interface PeriodOpened {
  month: string
}
