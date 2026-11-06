import { confluent, type Actions } from '@cella/org-actions'

export const actions = {
  // the last writer wins; an invoice bills one contact
  'contact-invoice:billing:link': confluent({ power: 'issue-invoice' }),
} satisfies Actions

export interface Link {
  invoice: string
  contact: string
}
