import type { App } from '@cella/org-ui'
import Capture from './blocks/Capture.svelte'
import Receipts from './blocks/Receipts.svelte'

// The graft's client side: the expenses' New form, a claim carrying its
// receipt; how many receipts each holds; and in an expense's Receipts tab
// its receipts, with another attached.
export const app: App = {
  name: 'expense-file',
  extends: {
    expenses: {
      create: Capture,
      columns: [{ key: 'receipts', label: 'Receipts', kind: 'number', role: 'hidden', value: (r: { receipts: number }) => r.receipts }],
      page: { blocks: [{ tab: 'receipts', block: Receipts }] },
    },
  },
}
