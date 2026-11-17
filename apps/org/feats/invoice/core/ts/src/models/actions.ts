import { bounded, confluent, ordered, type Actions } from '@cella/org-actions'

export const actions = {
  // numbered in a series; the server's own until rung 2 gives devices theirs
  'invoice:invoice:issue': bounded('series', { power: 'issue-invoice' }),
  // to a client, or to a peer co-op
  'invoice:invoice:send': confluent({ power: 'issue-invoice' }),
  // payments add up; an overpayment becomes a credit, and the same
  // bank reference recorded twice merges into one
  'invoice:invoice:payment': confluent({ power: 'record-receipt' }),
  // ordered against the payments
  'invoice:invoice:void': ordered({ power: 'issue-invoice' }),
  // each save carries the whole merged snapshot, so the later receipt holds every edit before it
  'invoice:body:save': confluent({ power: 'discuss' }),
} satisfies Actions
