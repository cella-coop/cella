import { confluent, type Actions } from '@cella/org-actions'

export const actions = {
  // the last writer wins; an invoice bills one client
  'client-invoice:billing:link': confluent({ power: 'issue-invoice' }),
} satisfies Actions

export interface Link {
  invoice: string
  client: string
}
