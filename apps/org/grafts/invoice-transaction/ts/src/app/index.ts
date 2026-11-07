import type { App } from '@cella/org-ui'
import type { Posted } from '../models/posting.ts'
import Books from './blocks/Books.svelte'

// The graft's client side: what an invoice put in the books, and the
// payment and void forms whose writes post, in its Postings tab.
export const app: App = {
  name: 'invoice-transaction',
  extends: {
    invoices: {
      page: {
        related: (p: Posted[]) =>
          [...new Map(p.map((x) => [x.entry, x])).values()].map((x) => ({ label: x.entry, sub: x.event, href: `/transactions/${x.entry}` })),
        tabs: [{ id: 'postings', label: 'Postings' }],
        blocks: [{ tab: 'postings', block: Books }],
      },
    },
  },
}
