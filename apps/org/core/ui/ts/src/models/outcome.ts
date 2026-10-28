// A write's outcome as the page receives it from its action: settled with
// its log entry, refused with its reason, pending on its receipt, failed
// before any verdict, or unknown when no answer came back; what reacted
// to it; and, for a write of several stopped part-way, the fields of
// those it wrote first, which stand.
export interface Outcome {
  op: string
  state: 'settled' | 'pending' | 'refused' | 'failed' | 'unknown'
  entry?: number
  verdict?: number
  receipt?: number
  reason?: string
  then: Outcome[]
  spent?: string[]
}

// The op an outcome names when the shell cannot say which write it was.
export const none = 'none:none:none'

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
    case 'unknown':
      return 'No answer came back'
  }
}
