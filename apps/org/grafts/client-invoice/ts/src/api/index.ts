// The graft's writes, POST /api/client-invoice/<op> once the server exists,
// its reads, and its slice, which the shell mounts.
import { action, type Slice } from '@cella/org-db'
import { link } from '../handlers/link.ts'
import { billed, bills, clientOf, standing } from '../drivers/billing.ts'

export { link } from '../handlers/link.ts'
export { billed, bills, clientOf, standing } from '../drivers/billing.ts'

// The billing on both sides: whom an invoice bills, and linking it; what a
// client owes, and the invoices that bill it.
export const slice: Slice = {
  name: 'client-invoice',
  extends: {
    invoices: {
      list: clientOf,
      item: billed,
      actions: {
        link: action('client-invoice:billing:link', (form, id) => ({ invoice: id ?? '', client: form.get('client') }), link),
      },
    },
    clients: {
      list: standing,
      item: bills,
    },
  },
}
