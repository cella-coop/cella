import { icons, type App } from '@cella/org-ui'
import type { Account, Period } from '../models/account.ts'
import type { Allocation, Detail } from '../models/allocation.ts'
import Close from './blocks/Close.svelte'
import Shares from './blocks/Shares.svelte'

const open = (p: Period) => (p.closed ? 'closed' : 'open')
const allocated = (a: Allocation) => (a.allocated ? 'allocated' : 'to allocate')

// The feat's client side: the chart of accounts, the periods of the books
// and a period's close, and each year's surplus with its split.
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
    allocations: {
      view: {
        group: 'finance',
        title: 'Allocations',
        caption: 'Each year’s surplus, split as the statutes and the law require',
        icon: icons.ChartPie,
        columns: [
          { key: 'year', label: 'Year', kind: 'title', role: 'title', value: (a: Allocation) => String(a.year) },
          { key: 'surplus', label: 'Surplus', kind: 'money', role: 'meta', value: (a: Allocation) => a.surplus },
          { key: 'work', label: 'Work share', kind: 'money', role: 'hidden', value: (a: Allocation) => a.work },
          { key: 'legal', label: 'Legal reserve', kind: 'money', role: 'hidden', value: (a: Allocation) => a.legal },
          { key: 'development', label: 'Development fund', kind: 'money', role: 'hidden', value: (a: Allocation) => a.development },
          { key: 'interest', label: 'Interest', kind: 'money', role: 'hidden', value: (a: Allocation) => a.interest },
          { key: 'basis', label: 'Work share by', kind: 'badge', role: 'hidden', value: (a: Allocation) => a.basis },
          { key: 'state', label: 'State', kind: 'badge', role: 'meta', value: allocated, tone: (a: Allocation) => (a.allocated ? 'positive' : 'accent') },
        ],
        look: { layout: 'table' },
      },
      page: {
        eyebrow: 'Allocation',
        title: (a: Detail) => `${a.year} surplus`,
        subtitle: (a: Detail) => (a.allocated ? `allocated on ${a.allocated}` : 'to allocate once the assembly decides'),
        properties: (a: Detail) => [
          { label: 'State', value: allocated(a), kind: 'badge', tone: a.allocated ? 'positive' : 'accent' },
          { label: 'Surplus', value: a.surplus, kind: 'money' },
          { label: 'Work share by', value: a.basis, kind: 'badge' },
          { label: 'Allocated on', value: a.allocated, kind: 'date' },
        ],
        blocks: [Shares],
      },
    },
  },
}
