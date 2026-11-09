// The graft's writes, POST /api/invoice-project/<op> once the server
// exists, its reads, and its slice, which the shell mounts.
import { action, type Slice } from '@cella/org-db'
import { link } from '../handlers/link.ts'
import { charged, invoiced, invoicedBy, projectOf } from '../drivers/charge.ts'
import { contract } from './contract.ts'

export { link } from '../handlers/link.ts'
export { charged, invoiced, invoicedBy, projectOf } from '../drivers/charge.ts'

// The project an invoice bills, and naming it; a project's invoices and
// what they invoiced.
export const slice: Slice = {
  name: 'invoice-project',
  queries: contract,
  extends: {
    invoices: {
      list: projectOf,
      item: charged,
      actions: {
        // Named apart from contact-invoice's `link`, which the same page offers.
        charge: action('invoice-project:invoice:link', (form, id) => ({ invoice: id ?? '', project: form.get('project') }), link),
      },
    },
    projects: {
      list: invoicedBy,
      item: invoiced,
    },
  },
}
