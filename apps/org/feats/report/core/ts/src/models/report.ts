import type { Head, Report as Definition, Result } from '@cella/org-analytics'

// How a saved report is drawn: the statements, the margins and the
// federation figures by the feat itself, a custom one from its definition.
export type Kind = 'income' | 'balance' | 'margins' | 'federation' | 'custom'

// How a custom report is charted: bars over a field it shows, each the
// value of a measure or a numeric field.
export interface Chart {
  by: string
  value: string
}

// A custom report's definition: a port report, and its chart.
export type Saved = Definition & { chart?: Chart }

// A saved report as the collection lists it.
export interface Report {
  id: string
  title: string
  caption: string
  kind: Kind
  definition: Saved | null
  owner: string | null
  saved: string | null
}

// What saving a custom report asks.
export interface Save {
  id: string
  title: string
  caption: string
  definition: Saved
}

export interface Stored {
  report: string
}

// A report's page: the saved report, the log's head it read, and what it
// drew, or why it drew nothing.
export interface Drawn<T = unknown> {
  report: Report
  head: Head | null
  drawn: T | null
  failed?: string
}

// A custom report's run: its rows and its chart's bars.
export interface Custom {
  result: Result
  bars: { label: string; value: number }[]
}
