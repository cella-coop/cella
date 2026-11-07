import type { App } from '@cella/org-ui'
import type { Employed as Became } from '../models/patronage.ts'
import Employed from './blocks/Employed.svelte'
import Return from './blocks/Return.svelte'
import Statements from './blocks/Statements.svelte'

// The graft's client side: what a worker's part of the work share became,
// in their statement's Employed tab; a member's own statements, on their page; and a
// year's return to the federation, on the distribution's page.
export const app: App = {
  name: 'account-membership-patronage-transaction',
  extends: {
    statements: {
      page: {
        related: (e: Became | null) => (e?.entry ? [{ label: e.entry, sub: 'employed the part in shares', href: `/transactions/${e.entry}` }] : []),
        tabs: [{ id: 'employed', label: 'Employed' }],
        blocks: [{ tab: 'employed', block: Employed }],
      },
    },
    distributions: {
      page: {
        tabs: [{ id: 'return', label: 'Return' }],
        blocks: [{ tab: 'return', block: Return }],
      },
    },
    people: {
      page: {
        blocks: [Statements],
      },
    },
  },
}
