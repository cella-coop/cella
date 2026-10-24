// A write's outcome as the page receives it from its action: settled with
// its log entry, refused with its reason, pending on its receipt, or failed
// before any verdict; and what reacted to it.
export interface Outcome {
  op: string
  state: 'settled' | 'pending' | 'refused' | 'failed'
  entry?: number
  verdict?: number
  receipt?: number
  reason?: string
  then: Outcome[]
}

export const said = (o: Outcome) => {
  switch (o.state) {
    case 'settled':
      return `Settled, log entry ${o.entry}`
    case 'pending':
      return `Pending on receipt ${o.receipt}`
    case 'refused':
      return `Refused after verdict ${o.verdict}`
    case 'failed':
      return 'Not submitted'
  }
}
