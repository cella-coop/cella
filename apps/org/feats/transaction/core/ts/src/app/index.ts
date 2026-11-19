import { icons, type App } from '@cella/org-ui'
import type { Detail, Journaled } from '../models/transaction.ts'
import Lines from './blocks/Lines.svelte'
import Body from './blocks/Body.svelte'

// The feat's client side: the journal as the shell's transactions, and an
// entry's page, named by its label, which opens on its lines, then its
// notes.
export const app: App = {
  name: 'transaction',
  collections: {
    transactions: {
      view: {
        title: 'Transactions',
        caption: 'The journal: every transaction in order',
        icon: icons.ArrowsLeftRight,
        columns: [
          { key: 'label', label: 'Label', kind: 'title', role: 'title', value: (e: Journaled) => e.label },
          { key: 'id', label: 'Entry', kind: 'mono', role: 'hidden', value: (e: Journaled) => e.id },
          { key: 'corrects', label: 'Corrects', kind: 'mono', role: 'hidden', value: (e: Journaled) => e.corrects },
          { key: 'date', label: 'Date', kind: 'date', role: 'meta', value: (e: Journaled) => e.date },
          { key: 'amount', label: 'Amount', kind: 'money', role: 'meta', value: (e: Journaled) => e.amount },
        ],
        // Read by what happened, month by month, the latest first.
        look: { by: 'date', sort: { field: 'date', dir: 'desc' } },
      },
      page: {
        eyebrow: 'Transaction',
        title: (e: Detail) => e.label,
        subtitle: (e: Detail) => e.id,
        properties: (e: Detail) => [
          { label: 'Date', value: e.date, kind: 'date', lead: 'dated' },
          { label: 'Receipt', value: e.receipt, kind: 'mono', lead: 'receipt' },
          { label: 'Corrects', value: e.corrects, kind: 'mono', href: e.corrects ? `/transactions/${e.corrects}` : undefined, lead: 'corrects' },
        ],
        related: (e: Detail) => e.corrected.map((c) => ({ label: c, sub: 'corrects it', href: `/transactions/${c}` })),
        layout: 'panels',
        body: Body,
        blocks: [Lines],
      },
    },
  },
}
