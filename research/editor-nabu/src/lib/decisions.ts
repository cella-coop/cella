// The decisions a document can embed, as the Lanterne fixture has them.
// The card renders from this; the document holds only the reference.

export type Decision = {
  id: string
  title: string
  circle: string
  rule: string
  deadline: string
  votes: { member: string; stance: 'consent' | 'object' }[]
}

export const decisions: Record<string, Decision> = {
  'd-2026-011': {
    id: 'd-2026-011',
    title: 'Raise the day rate for 2027',
    circle: 'coordination',
    rule: 'consent',
    deadline: '2026-11-09',
    votes: [
      { member: 'camille', stance: 'consent' },
      { member: 'malik', stance: 'object' },
    ],
  },
}
