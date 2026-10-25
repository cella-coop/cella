export const contracts = ['permanent', 'fixed-term', 'apprenticeship'] as const
export type Contract = (typeof contracts)[number]

// A worker as the feat reads them, member or not; `id` is their address.
// Their time a week is in hours; a contract runs from `start` to `until`,
// both included, and a permanent one until they leave.
export interface Worker {
  id: string
  address: string
  name: string
  job: string
  contract: Contract
  start: string
  until: string | null
  hours: number
  hired: string
  // Whether they are employed on the scope's day.
  employed: boolean
}

// A hire, as its write names it: time a week in whole minutes, since a
// signed request holds integers only.
export interface Hire {
  worker: string
  name: string
  job: string
  contract: Contract
  start: string
  until?: string
  minutes: number
}

export interface Hired {
  worker: string
  job: string
  contract: Contract
  start: string
  until: string | null
  minutes: number
  hired: string
}
