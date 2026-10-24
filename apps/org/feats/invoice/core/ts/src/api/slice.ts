import { action, type Slice } from '@cella/org-db'
import { annul, issue, payment, send } from '../handlers/index.ts'
import { invoice, invoices, offered } from '../drivers/invoice.ts'
import * as forms from './forms.ts'

// The feat's server side as the shell mounts it: the invoices, what a new
// one may be issued in, and its writes. A graft that posts an invoice's
// events to the books replaces issue, payment and void with its own,
// which run these in the same transaction.
export const slice: Slice = {
  name: 'invoice',
  collections: {
    invoices: {
      list: invoices,
      about: offered,
      item: invoice,
      index: async (db) => (await invoices(db)).map((i) => ({ id: i.id, title: i.id, sub: `${i.bill_to}, ${i.label}` })),
      actions: {
        issue: action('invoice:invoice:issue', (form) => forms.issue(form), issue),
        send: action('invoice:invoice:send', (_, id) => forms.sending(id ?? ''), send),
        payment: action('invoice:invoice:payment', (form, id) => forms.payment(form, id ?? ''), payment),
        void: action('invoice:invoice:void', (form, id) => forms.voiding(form, id ?? ''), annul),
      },
    },
  },
}
