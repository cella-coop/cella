import { confluent, type Actions } from '@cella/org-actions'

export const actions = {
  // the last writer wins; an invoice bills one project's work
  'invoice-project:invoice:link': confluent({ power: 'issue-invoice' }),
} satisfies Actions

export interface Link {
  invoice: string
  project: string
}
