import type { App } from '@cella/org-ui'
import type { Balance as Balanced } from '../models/balance.ts'
import Balance from './blocks/Balance.svelte'
import Entries from './blocks/Entries.svelte'
import Month from './blocks/Month.svelte'
import Movements from './blocks/Movements.svelte'

// The graft's client side: each account's debits, credits and balance in
// the chart, whether the trial balance agrees, an account's balance on
// its overview and its ledger in its Ledger tab, and a period's entries
// summed on its overview and listed in its Entries tab.
export const app: App = {
  name: 'account-transaction',
  extends: {
    accounts: {
      // The journal's debits and credits over the chart agree when every
      // entry balanced: the whole journal's, which the server says, since
      // a reader may read only some accounts' lines.
      status: (about: { agrees?: boolean } | null) =>
        about?.agrees
          ? { label: 'trial balance agrees', tone: 'positive' }
          : { label: 'trial balance off', tone: 'negative' },
      columns: [
        { key: 'debit', label: 'Debit', kind: 'money', role: 'hidden', value: (r: Partial<Balanced>) => r.debit ?? 0 },
        { key: 'credit', label: 'Credit', kind: 'money', role: 'hidden', value: (r: Partial<Balanced>) => r.credit ?? 0 },
        { key: 'balance', label: 'Balance', kind: 'money', role: 'meta', value: (r: Partial<Balanced>) => r.balance ?? 0 },
      ],
      page: {
        blocks: [Balance, { tab: 'ledger', block: Movements }],
      },
    },
    periods: {
      page: {
        blocks: [Month, { tab: 'entries', block: Entries }],
      },
    },
    // Each entry in the journal wears its category, the accounts it is
    // about, as a chip: green what came in, amber what was spent, plain
    // what only moved between the balance sheet's accounts.
    transactions: {
      columns: [
        {
          key: 'category',
          label: 'Category',
          kind: 'badge',
          role: 'meta',
          value: (r: { category?: string | null }) => r.category ?? null,
          tone: (r: { flow?: string }) => (r.flow === 'income' ? 'positive' : r.flow === 'expense' ? 'warning' : 'neutral'),
        },
      ],
    },
  },
}
