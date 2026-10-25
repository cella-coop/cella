import { icons, type App } from '@cella/org-ui'
import type { Account, Period } from '../models/account.ts'
import type { Allocation, Detail } from '../models/allocation.ts'
import type { Terms } from '../models/terms.ts'
import type { Sheet, Statement } from '../models/statement.ts'
import Close from './blocks/Close.svelte'
import Shares from './blocks/Shares.svelte'
import Basis from './blocks/Basis.svelte'

const open = (p: Period) => (p.closed ? 'closed' : 'open')
const allocated = (a: Allocation) => (a.allocated ? 'allocated' : 'to allocate')
const adopted = (t: Terms) => (t.adopted ? 'adopted' : 'drafted')
const bases: Record<Terms['basis'], string> = { salary: 'by pay', hours: 'by time worked', equal: 'in equal parts', mix: 'by a mix' }
const mix = (t: Terms) =>
  [
    [t.salary, 'pay'],
    [t.hours, 'time worked'],
    [t.equal, 'equal parts'],
  ]
    .filter(([w]) => Number(w) > 0)
    .map(([w, n]) => `${w} % ${n}`)
    .join(', ')

// The feat's client side: the chart of accounts, the periods of the books
// and a period's close, each year's surplus with its split, the work
// share's terms, and each worker's statement of their part.
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
        tabs: [{ id: 'split', label: 'Split' }],
        related: (a: Detail) => (a.allocated ? [{ label: `${a.year} statements`, sub: 'each worker’s part', href: '/statements' }] : []),
        blocks: [Shares],
      },
    },
    terms: {
      view: {
        group: 'finance',
        title: 'Terms',
        caption: 'How the statutes divide each year’s work share among the workers',
        icon: icons.SealCheck,
        columns: [
          { key: 'from', label: 'From', kind: 'title', role: 'title', value: (t: Terms) => String(t.from) },
          { key: 'basis', label: 'Divides', role: 'sub', value: (t: Terms) => `${bases[t.basis]}: ${mix(t)}` },
          { key: 'capital', label: 'In shares %', kind: 'number', role: 'hidden', value: (t: Terms) => t.capital },
          { key: 'adopted', label: 'Adopted on', kind: 'date', role: 'hidden', value: (t: Terms) => t.adopted },
          { key: 'state', label: 'State', kind: 'badge', role: 'meta', value: adopted, tone: (t: Terms) => (t.adopted ? 'positive' : 'accent') },
        ],
      },
      page: {
        eyebrow: 'Terms',
        title: (t: Terms) => `Work share terms from ${t.from}`,
        subtitle: (t: Terms) => (t.adopted ? `adopted on ${t.adopted}` : 'drafted: adopted once the members decide'),
        properties: (t: Terms) => [
          { label: 'State', value: adopted(t), kind: 'badge', tone: t.adopted ? 'positive' : 'accent' },
          { label: 'From', value: String(t.from) },
          { label: 'By pay %', value: t.salary, kind: 'number' },
          { label: 'By time worked %', value: t.hours, kind: 'number' },
          { label: 'In equal parts %', value: t.equal, kind: 'number' },
          { label: 'Employed in shares %', value: t.capital, kind: 'number' },
          { label: 'Adopted on', value: t.adopted, kind: 'date' },
        ],
      },
    },
    statements: {
      view: {
        group: 'finance',
        title: 'Statements',
        caption: 'Each worker’s part of each year’s work share',
        icon: icons.Receipt,
        columns: [
          { key: 'year', label: 'Year', kind: 'title', role: 'title', value: (s: Statement) => String(s.year) },
          { key: 'worker', label: 'Worker', kind: 'mono', role: 'sub', value: (s: Statement) => s.worker },
          { key: 'salary', label: 'By pay', kind: 'money', role: 'hidden', value: (s: Statement) => s.salary },
          { key: 'hours', label: 'By time', kind: 'money', role: 'hidden', value: (s: Statement) => s.hours },
          { key: 'equal', label: 'Equal', kind: 'money', role: 'hidden', value: (s: Statement) => s.equal },
          { key: 'amount', label: 'Part', kind: 'money', role: 'meta', value: (s: Statement) => s.amount },
        ],
        look: { layout: 'table' },
        empty: 'A statement is drawn for each worker when a year’s surplus is allocated.',
      },
      page: {
        eyebrow: 'Statement',
        title: (s: Sheet) => `${s.year} work share statement`,
        subtitle: (s: Sheet) => `${s.worker}${s.allocated ? `, allocated on ${s.allocated}` : ''}`,
        properties: (s: Sheet) => [
          { label: 'Year', value: String(s.year) },
          { label: 'Part', value: s.amount, kind: 'money' },
          { label: 'Terms', value: s.terms ? `${s.terms.id}, ${bases[s.terms.basis]}` : null, href: s.terms ? `/terms/${s.terms.id}` : undefined },
          { label: 'Allocated on', value: s.allocated, kind: 'date' },
        ],
        related: (s: Sheet) => [{ label: `${s.year} surplus`, sub: 'the allocation', href: `/allocations/${s.allocation}` }],
        blocks: [Basis],
      },
    },
  },
}
