import { icons, type App } from '@cella/org-ui'
import type { Detail, Journaled } from '../models/transaction.ts'
import Lines from './blocks/Lines.svelte'

// The feat's client side: the journal as the shell's transactions, and an
// entry's page, named by its label, its lines in a tab of their own.
export const app: App = {
  name: 'transaction',
  collections: {
    transactions: {
      view: {
        group: 'ledger',
        title: 'Transactions',
        caption: 'The journal: every transaction in order',
        icon: icons.ArrowsLeftRight,
        columns: [
          { key: 'id', label: 'Entry', kind: 'mono', role: 'title', value: (e: Journaled) => e.id },
          { key: 'label', label: 'Label', role: 'sub', value: (e: Journaled) => e.label },
          { key: 'corrects', label: 'Corrects', kind: 'mono', role: 'hidden', value: (e: Journaled) => e.corrects },
          { key: 'date', label: 'Date', kind: 'date', role: 'meta', value: (e: Journaled) => e.date },
          { key: 'amount', label: 'Amount', kind: 'money', role: 'meta', value: (e: Journaled) => e.amount },
        ],
      },
      page: {
        eyebrow: 'Transaction',
        title: (e: Detail) => e.label,
        subtitle: (e: Detail) => e.id,
        properties: (e: Detail) => [
          { label: 'Date', value: e.date, kind: 'date' },
          { label: 'Amount', value: e.amount, kind: 'money' },
          { label: 'Receipt', value: e.receipt, kind: 'number' },
          { label: 'Corrects', value: e.corrects, kind: 'mono', href: e.corrects ? `/transactions/${e.corrects}` : undefined },
        ],
        related: (e: Detail) => e.corrected.map((c) => ({ label: c, sub: 'corrects it', href: `/transactions/${c}` })),
        tabs: [
          { id: 'overview', label: 'Overview' },
          { id: 'lines', label: 'Lines' },
        ],
        blocks: [{ tab: 'lines', block: Lines }],
      },
    },
  },
}
