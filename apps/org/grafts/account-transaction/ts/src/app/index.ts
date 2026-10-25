import type { App } from '@cella/org-ui'
import type { Balance, Ledger } from '../models/balance.ts'
import type { Figures } from '../models/statement.ts'
import Movements from './blocks/Movements.svelte'
import Income from './blocks/Income.svelte'
import Balances from './blocks/Balance.svelte'


// The graft's client side: each account's debits, credits and balance in
// the chart, whether the trial balance agrees, an account's ledger, and
// each span's income statement and balance sheet against the span before
// it, in the PCG's presentation.
export const app: App = {
  name: 'account-transaction',
  extends: {
    accounts: {
      // The journal's debits and credits over the chart agree when every
      // entry balanced: the whole journal's, which the server says, since
      // a reader may read only some accounts' lines.
      status: (_rows: Partial<Balance>[], about: { agrees?: boolean } | null) =>
        about?.agrees
          ? { label: 'trial balance agrees', tone: 'positive' }
          : { label: 'trial balance off', tone: 'negative' },
      dashboard: [
        { kind: 'kpi', title: 'Debits', measure: { op: 'sum', field: 'debit' } },
        { kind: 'kpi', title: 'Credits', measure: { op: 'sum', field: 'credit' } },
        { kind: 'kpi', title: 'Cash', measure: { op: 'sum', field: 'balance' }, where: [{ field: 'cash', is: ['cash'] }] },
        { kind: 'chart', title: 'Balance by kind', measure: { op: 'sum', field: 'balance' }, by: 'kind' },
      ],
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
    // Each span's result and total assets, and its two statements.
    reports: {
      columns: [
        {
          key: 'result',
          label: 'Result',
          kind: 'money',
          role: 'meta',
          value: (r: Partial<Figures>) => r.result ?? 0,
          tone: (r: Partial<Figures>) => ((r.result ?? 0) < 0 ? 'negative' : 'neutral'),
        },
        { key: 'assets', label: 'Total assets', kind: 'money', role: 'hidden', value: (r: Partial<Figures>) => r.assets ?? 0 },
      ],
      page: {
        tabs: [
          { id: 'income', label: 'Income statement' },
          { id: 'balance', label: 'Balance sheet' },
        ],
        blocks: [
          { tab: 'income', block: Income },
          { tab: 'balance', block: Balances },
        ],
      },
    },
  },
}
