export interface Rebill {
  expense: string
  project: string
}

// An expense's project, and the live projects it may be filed under.
export interface Filed {
  project: string | null
  title: string | null
  projects: { id: string; title: string }[]
}

// What a project's members spent for it, in cents, and each expense.
export interface Spent {
  approved: number
  pending: number
  expenses: { id: string; label: string; day: string; total: number; status: string }[]
}
