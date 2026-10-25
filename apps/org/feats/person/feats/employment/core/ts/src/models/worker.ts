export const contracts = ['permanent', 'fixed-term', 'apprenticeship'] as const
export type Contract = (typeof contracts)[number]

// Each contract in words.
export const terms: Record<Contract, string> = { permanent: 'Permanent', 'fixed-term': 'Fixed-term', apprenticeship: 'Apprenticeship' }

// An employment as the feat reads it, member or not, with the name of the
// person who holds it; `id` is their address.
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
// signed request holds integers only, and the first device it enrols.
export interface Hire {
  worker: string
  name: string
  job: string
  contract: Contract
  start: string
  until?: string
  minutes: number
  // The worker's first device: the public key in hex their device made,
  // whose private key never leaves it, and the label they gave it.
  key: string
  label: string
}

export interface Hired {
  worker: string
  job: string
  contract: Contract
  start: string
  until: string | null
  minutes: number
  hired: string
  key: string
}

// A person's employment on their page, if they hold one.
export interface Employment {
  worker: Worker | null
}
