// What a project is watched for: its budget spent past the threshold while
// under way, its spend forecast over its budget, or a thin margin.
export type Watch = 'on track' | 'budget spent' | 'over budget' | 'thin margin'

// A project's margin on the scope's day, in cents: what it invoiced less
// what its time cost and its approved expenses, that margin as a percent
// of what it invoiced; its budget burn, the spend forecast at completion
// and the margin forecast at completion (`landing`); and whether it is
// watched, `archived` once it is.
export interface Margin {
  project: string
  title: string
  invoiced: number
  cost: number
  expenses: number
  margin: number
  percent: number | null
  budget: number | null
  spent: number
  burn: number | null
  forecast: number | null
  landing: number | null
  watch: Watch | 'archived'
}

// The margins on a day, and the threshold in force on it.
export interface Margins {
  day: string
  threshold: { burn: number; margin: number } | null
  projects: Margin[]
}
