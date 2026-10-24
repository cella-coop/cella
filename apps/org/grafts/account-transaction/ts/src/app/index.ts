import type { App } from '@cella/org-ui'
import type { Balance, Ledger } from '../models/balance.ts'
import Movements from './blocks/Movements.svelte'
import Trial from './blocks/Trial.svelte'

// The graft's client side: each account's debits, credits and balance in
// the chart, the trial balance, and an account's ledger.
export const app: App = {
  name: 'account-transaction',
  extends: {
    accounts: {
      summary: Trial,
      columns: [
        { key: 'debit', label: 'Debit', kind: 'money', role: 'hidden', value: (r: Partial<Balance>) => r.debit ?? 0 },
        { key: 'credit', label: 'Credit', kind: 'money', role: 'hidden', value: (r: Partial<Balance>) => r.credit ?? 0 },
        { key: 'balance', label: 'Balance', kind: 'money', role: 'meta', value: (r: Partial<Balance>) => r.balance ?? 0 },
      ],
      page: {
        properties: (l: Ledger) => [
          { label: 'Debit', value: l.debit, kind: 'money' },
          { label: 'Credit', value: l.credit, kind: 'money' },
          { label: 'Balance', value: l.balance, kind: 'money', tone: l.balance < 0 ? 'negative' : undefined },
        ],
        blocks: [Movements],
      },
    },
  },
}
