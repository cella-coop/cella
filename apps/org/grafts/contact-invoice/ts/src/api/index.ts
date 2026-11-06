// The graft's writes, POST /api/contact-invoice/<op> once the server exists,
// its reads, and its slice, which the shell mounts.
import { action, type Slice } from '@cella/org-db'
import { link } from '../handlers/link.ts'
import { billed, bills, contactOf, standing } from '../drivers/billing.ts'

export { link } from '../handlers/link.ts'
export { billed, bills, contactOf, standing } from '../drivers/billing.ts'

// The billing on both sides: whom an invoice bills, and linking it; what a
// contact owes, and the invoices that bill it.
export const slice: Slice = {
  name: 'contact-invoice',
  extends: {
    invoices: {
      list: contactOf,
      item: billed,
      actions: {
        link: action('contact-invoice:billing:link', (form, id) => ({ invoice: id ?? '', contact: form.get('contact') }), link),
      },
    },
    contacts: {
      list: standing,
      item: bills,
    },
  },
}
