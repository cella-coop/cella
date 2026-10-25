// A candidate's admission as their page reads it: their probation and the
// shares they pledge; the decision that moves to admit them, if any, and
// whether it is still open; and, when a proposal is due, what the form
// that makes it starts from.
export interface Admission {
  address: string
  name: string
  stage: 'candidate' | 'invited'
  probationEnd: string
  ended: boolean
  pledged: number
  decision: string | null
  title: string | null
  deadline: string | null
  closed: string | null
  due: boolean
  // The proposal's deadline unless the proposer says otherwise, two weeks
  // from the scope's day, and its reasons in a sentence.
  until: string
  why: string
}
