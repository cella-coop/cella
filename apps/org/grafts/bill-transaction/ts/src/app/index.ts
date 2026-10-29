import type { App } from '@cella/org-ui'
import type { Posted } from '../models/posting.ts'
import Books from './blocks/Books.svelte'

// The graft's client side: what a bill put in the books.
export const app: App = {
  name: 'bill-transaction',
  extends: {
    bills: {
      page: {
        related: (p: Posted[]) =>
          [...new Map(p.map((x) => [x.entry, x])).values()].map((x) => ({ label: x.entry, sub: x.event, href: `/transactions/${x.entry}` })),
        blocks: [Books],
      },
    },
  },
}
