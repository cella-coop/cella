// What a project is watched for: its budget spent past the threshold while
// under way, its spend forecast over its budget, or a thin margin.
export type Watch = 'on track' | 'budget spent' | 'over budget' | 'thin margin'

// A project's margin on a day, in cents: what it invoiced less what its
// time cost and its approved expenses, the margin as a percent of what it
// invoiced; its budget burn, the spend forecast at completion and the
// margin forecast at completion (`landing`); and whether it is watched,
// null once archived.
export interface Margin {
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
  watch: Watch | null
}

// A project's margin as the projects list it: its watch as its badge
// shows it, `archived` once it is.
export interface Listed extends Omit<Margin, 'watch'> {
  watch: Watch | 'archived'
}
