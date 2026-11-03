export const stages = ['employee', 'candidate', 'invited', 'member', 'gone'] as const
export type Stage = (typeof stages)[number]

// A candidacy as its write is asked: the worker, who opens their own on
// their application, and the shares they subscribe if admitted.
export interface Open {
  worker: string
  shares: number
}

// The candidacy opened: the probation from and to, both included, from
// the hire to the day before the application.
export interface Opened extends Open {
  from: string
  to: string
  opened: string
}

// Where someone stands on the way to membership, with the day of each
// step they took: hired, on probation as a candidate, invited or applied,
// admitted, gone. `due` is whether their probation is over while they are
// not yet admitted.
export interface Path {
  address: string
  name: string
  stage: Stage
  hired: string | null
  left: string | null
  // Whether their contract has ended, by the scope's day.
  ended: boolean
  probation: string | null
  probationEnd: string | null
  pledged: number | null
  invited: string | null
  applied: string | null
  admitted: string | null
  exited: string | null
  due: boolean
}
