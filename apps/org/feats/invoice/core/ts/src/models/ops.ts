import { bounded, confluent, ordered, type Ops } from '@cella/org-ops'

export const ops = {
  // numbered in a series; the server's own until rung 2 gives devices theirs
  'invoice:invoice:issue': bounded('series'),
  // to a client, or to a peer co-op
  'invoice:invoice:send': confluent(),
  // payments add up; an overpayment becomes a credit, and the same
  // bank reference recorded twice merges into one
  'invoice:invoice:payment': confluent(),
  // ordered against the payments
  'invoice:invoice:void': ordered(),
} satisfies Ops
