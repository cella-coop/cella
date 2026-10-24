import { confluent, type Ops } from '@cella/org-ops'

export const ops = {
  // the last writer wins; an invoice bills one project's work
  'invoice-project:invoice:link': confluent({ power: 'issue-invoice' }),
} satisfies Ops

export interface Link {
  invoice: string
  project: string
}
