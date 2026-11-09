import { action, type Slice } from '@cella/org-db'
import { annul, issue, payment, send } from '../handlers/index.ts'
import { invoice, invoices, listing, offered, printed } from '../drivers/invoice.ts'
import * as forms from './forms.ts'
import { pdf } from './pdf.ts'
import { contract } from './contract.ts'

// The feat's server side as the shell mounts it: the invoices, what a new
// one may be issued in, and its writes. A graft that posts an invoice's
// events to the books replaces issue, payment and void with its own,
// which run these in the same transaction. An invoice's bytes are its PDF,
// made from it as issued, which whoever reads the invoice may open.
export const slice: Slice = {
  name: 'invoice',
  queries: contract,
  collections: {
    invoices: {
      list: listing,
      about: offered,
      item: invoice,
      content: async (db, id) => {
        const found = await printed(db, id)
        return found && { name: `${id}.pdf`, type: 'application/pdf', bytes: pdf(found), open: true }
      },
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
