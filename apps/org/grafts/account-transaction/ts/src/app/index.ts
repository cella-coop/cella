import type { App } from '@cella/org-ui'
import type { Balance, Ledger } from '../models/balance.ts'
import Movements from './blocks/Movements.svelte'

const sum = (rows: Partial<Balance>[], f: (r: Partial<Balance>) => number | undefined) => rows.reduce((s, r) => s + (f(r) ?? 0), 0)

// The graft's client side: each account's debits, credits and balance in
// the chart, whether the trial balance agrees, and an account's ledger.
export const app: App = {
  name: 'account-transaction',
  extends: {
    accounts: {
      // The journal's debits and credits over the chart agree when every
      // entry balanced.
      status: (rows: Partial<Balance>[]) =>
        sum(rows, (r) => r.debit) === sum(rows, (r) => r.credit)
          ? { label: 'trial balance agrees', tone: 'positive' }
          : { label: 'trial balance off', tone: 'negative' },
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
