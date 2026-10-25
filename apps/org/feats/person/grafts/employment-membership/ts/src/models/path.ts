export const stages = ['employee', 'candidate', 'invited', 'member', 'gone'] as const
export type Stage = (typeof stages)[number]

// A candidacy, as its write names it: the probation from and to, both
// included, and the shares the candidate subscribes if admitted.
export interface Open {
  worker: string
  from: string
  to: string
  shares: number
}

export interface Opened extends Open {
  opened: string
}

// Where someone stands on the way to membership, with the day of each
// step they took: hired, on probation as a candidate, invited, admitted,
// gone. `due` is whether their probation is over while they are not yet
// admitted.
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
  admitted: string | null
  exited: string | null
  due: boolean
  // The day a candidacy opened from the worker's page starts, their hire
  // or the scope's day, whichever is later.
  today: string
}
