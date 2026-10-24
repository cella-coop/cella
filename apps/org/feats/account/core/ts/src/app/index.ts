import { icons, type App } from '@cella/org-ui'
import type { Account, Period } from '../models/account.ts'
import Close from './blocks/Close.svelte'

const open = (p: Period) => (p.closed ? 'closed' : 'open')

// The feat's client side: the chart of accounts and the periods of the
// books, and a period's close.
export const app: App = {
  name: 'account',
  collections: {
    accounts: {
      view: {
        group: 'finance',
        title: 'Accounts',
        icon: icons.Bank,
        columns: [
          { key: 'code', label: 'Code', kind: 'mono', role: 'title', value: (a: Account) => a.code },
          { key: 'label', label: 'Account', role: 'sub', value: (a: Account) => a.label },
          { key: 'kind', label: 'Kind', kind: 'badge', role: 'hidden', value: (a: Account) => a.kind },
          { key: 'cash', label: 'Cash', kind: 'badge', role: 'hidden', value: (a: Account) => (a.cash ? 'cash' : 'other') },
        ],
      },
      page: {
        eyebrow: 'Account',
        title: (a: Account) => `${a.code} ${a.label}`,
        subtitle: (a: Account) => `${a.kind}${a.cash ? ', cash' : ''}`,
        properties: (a: Account) => [
          { label: 'Code', value: a.code, kind: 'mono' },
          { label: 'Kind', value: a.kind, kind: 'badge' },
          { label: 'Cash', value: a.cash ? 'yes' : 'no' },
          { label: 'Holder', value: a.holder },
          { label: 'Frozen', value: a.frozen ? 'yes' : 'no' },
        ],
      },
    },
    periods: {
      view: {
        group: 'finance',
        title: 'Periods',
        icon: icons.Calendar,
        columns: [
          { key: 'month', label: 'Month', kind: 'title', role: 'title', value: (p: Period) => p.month },
          { key: 'closed', label: 'Closed on', kind: 'date', role: 'meta', value: (p: Period) => p.closed },
          { key: 'state', label: 'State', kind: 'badge', role: 'meta', value: open, tone: (p: Period) => (p.closed ? 'neutral' : 'accent') },
        ],
      },
      page: {
        eyebrow: 'Period',
        title: (p: Period) => p.month,
        subtitle: (p: Period) => (p.closed ? `closed on ${p.closed}; nothing posts into it` : 'open: entries dated in it post'),
        properties: (p: Period) => [
          { label: 'State', value: open(p), kind: 'badge', tone: p.closed ? 'neutral' : 'accent' },
          { label: 'Closed on', value: p.closed, kind: 'date' },
        ],
        actions: Close,
      },
    },
  },
}
