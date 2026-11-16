import { icons, type App } from '@cella/org-ui'
import type { Account, Period } from '../models/account.ts'
import type { Terms } from '../models/terms.ts'
import Close from './blocks/Close.svelte'
import Open from './blocks/Open.svelte'

// A row as its collection lists it: its state, and an account cash or
// other, as their badges show them.
type Listed<T> = T & { state: string }
type Charted = Omit<Account, 'cash'> & { cash: 'cash' | 'other' }

const open = (p: Period) => (p.closed ? 'closed' : 'open')
const adopted = (t: Terms) => (t.adopted ? 'adopted' : 'drafted')

// The feat's client side: the chart of accounts, the periods of the books
// and a period's close, and the statutes' capital clauses. An account's
// ledger and a period's entries are the tabs its extenders fill.
export const app: App = {
  name: 'account',
  collections: {
    accounts: {
      view: {
        title: 'Accounts',
        icon: icons.Bank,
        columns: [
          { key: 'code', label: 'Code', kind: 'mono', role: 'title', value: (a: Account) => a.code },
          { key: 'label', label: 'Account', role: 'sub', value: (a: Account) => a.label },
          { key: 'kind', label: 'Kind', kind: 'badge', role: 'hidden', value: (a: Account) => a.kind },
          { key: 'cash', label: 'Cash', kind: 'badge', role: 'hidden', value: (a: Charted) => a.cash },
        ],
        // Balances compared down a table, by kind, in the chart's order.
        look: { layout: 'table', by: 'kind', hide: ['cash', 'debit', 'credit'], lanes: { kind: ['asset', 'liability', 'equity', 'income', 'expense'] } },
      },
      page: {
        eyebrow: 'Account',
        title: (a: Account) => `${a.code} ${a.label}`,
        properties: (a: Account) => [
          { label: 'Code', value: a.code, kind: 'mono' },
          { label: 'Kind', value: a.kind, kind: 'badge' },
          { label: 'Cash', value: a.cash ? 'yes' : 'no' },
          { label: 'Holder', value: a.holder },
          { label: 'Frozen', value: a.frozen ? 'yes' : 'no' },
        ],
        tabs: [
          { id: 'overview', label: 'Overview' },
          { id: 'ledger', label: 'Ledger' },
        ],
      },
    },
    periods: {
      view: {
        title: 'Periods',
        icon: icons.Calendar,
        create: Open,
        columns: [
          { key: 'month', label: 'Month', kind: 'title', role: 'title', value: (p: Period) => p.month },
          { key: 'closed', label: 'Closed on', kind: 'date', role: 'meta', value: (p: Period) => p.closed },
          { key: 'state', label: 'State', kind: 'badge', role: 'meta', value: (p: Listed<Period>) => p.state, tone: (p: Period) => (p.closed ? 'neutral' : 'accent') },
        ],
        // Which months can still take entries, the latest first.
        look: { by: 'state', lanes: { state: ['open', 'closed'] } },
      },
      page: {
        eyebrow: 'Period',
        title: (p: Period) => p.month,
        properties: (p: Period) => [
          { label: 'State', value: open(p), kind: 'badge', tone: p.closed ? 'neutral' : 'accent' },
          { label: 'Closed on', value: p.closed, kind: 'date' },
        ],
        tabs: [
          { id: 'overview', label: 'Overview' },
          { id: 'entries', label: 'Entries' },
        ],
        actions: Close,
      },
    },
    terms: {
      view: {
        title: 'Capital',
        caption: 'The statutes’ capital clauses: a share’s value, what an associate subscribes, and how one who leaves is repaid',
        icon: icons.SealCheck,
        columns: [
          { key: 'from', label: 'From', kind: 'title', role: 'title', value: (t: Terms) => String(t.from) },
          { key: 'share', label: 'Share value', kind: 'money', role: 'sub', value: (t: Terms) => t.share },
          { key: 'minimum', label: 'Fewest shares', kind: 'number', role: 'hidden', value: (t: Terms) => t.minimum },
          { key: 'adopted', label: 'Adopted on', kind: 'date', role: 'hidden', value: (t: Terms) => t.adopted },
          { key: 'state', label: 'State', kind: 'badge', role: 'meta', value: (t: Listed<Terms>) => t.state, tone: (t: Terms) => (t.adopted ? 'positive' : 'accent') },
        ],
      },
      page: {
        eyebrow: 'Capital terms',
        title: (t: Terms) => `Capital terms from ${t.from}`,
        subtitle: (t: Terms) => t.id,
        properties: (t: Terms) => [
          { label: 'State', value: adopted(t), kind: 'badge', tone: t.adopted ? 'positive' : 'accent' },
          { label: 'From', value: String(t.from) },
          { label: 'Share value', value: t.share, kind: 'money' },
          { label: 'Fewest shares', value: t.minimum, kind: 'number' },
          { label: 'Instalments, at most', value: t.instalments, kind: 'number' },
          { label: 'Repaid after, months', value: t.delay, kind: 'number' },
          { label: 'Yearly repayments', value: t.repayments, kind: 'number' },
          { label: 'Adopted on', value: t.adopted, kind: 'date' },
        ],
      },
    },
  },
}
