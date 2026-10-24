import { icons, type App } from '@cella/org-ui'
import type { Detail, Journaled } from '../models/transaction.ts'
import Lines from './blocks/Lines.svelte'

// The feat's client side: the journal, and an entry's page with its lines.
export const app: App = {
  name: 'transaction',
  collections: {
    journal: {
      view: {
        group: 'finance',
        title: 'Journal',
        icon: icons.BookOpen,
        columns: [
          { key: 'id', label: 'Entry', kind: 'mono', role: 'title', value: (e: Journaled) => e.id },
          { key: 'label', label: 'Label', role: 'sub', value: (e: Journaled) => e.label },
          { key: 'corrects', label: 'Corrects', kind: 'mono', role: 'hidden', value: (e: Journaled) => e.corrects },
          { key: 'date', label: 'Date', kind: 'date', role: 'meta', value: (e: Journaled) => e.date },
          { key: 'amount', label: 'Amount', kind: 'money', role: 'meta', value: (e: Journaled) => e.amount },
        ],
      },
      page: {
        eyebrow: 'Journal entry',
        title: (e: Detail) => e.id,
        subtitle: (e: Detail) => e.label,
        properties: (e: Detail) => [
          { label: 'Date', value: e.date, kind: 'date' },
          { label: 'Amount', value: e.amount, kind: 'money' },
          { label: 'Receipt', value: e.receipt, kind: 'number' },
          { label: 'Corrects', value: e.corrects, kind: 'mono', href: e.corrects ? `/journal/${e.corrects}` : undefined },
        ],
        related: (e: Detail) => e.corrected.map((c) => ({ label: c, sub: 'corrects it', href: `/journal/${c}` })),
        blocks: [Lines],
      },
    },
  },
}
