import { bounded, confluent, ordered, type Ops } from '@cella/org-ops'

export const ops = {
  // numbered in a series; the server's own until rung 2 gives devices theirs
  'invoice:invoice:issue': bounded('series', { power: 'issue-invoice' }),
  // to a client, or to a peer co-op
  'invoice:invoice:send': confluent({ power: 'issue-invoice' }),
  // payments add up; an overpayment becomes a credit, and the same
  // bank reference recorded twice merges into one
  'invoice:invoice:payment': confluent({ power: 'record-receipt' }),
  // ordered against the payments
  'invoice:invoice:void': ordered({ power: 'issue-invoice' }),
} satisfies Ops
