import { date, icons, type App } from '@cella/org-ui'
import type { Account, Period } from '../models/account.ts'
import type { Terms } from '../models/terms.ts'
import type { Report } from '../models/report.ts'
import Close from './blocks/Close.svelte'

const open = (p: Period) => (p.closed ? 'closed' : 'open')
const closed = (r: Report) => (r.closed ? 'closed' : 'open')
const kinds: Record<Report['kind'], string> = { month: 'Month', quarter: 'Quarter', year: 'Year' }
const adopted = (t: Terms) => (t.adopted ? 'adopted' : 'drafted')

// The feat's client side: the chart of accounts, the periods of the books
// and a period's close, the statutes' capital clauses, and the spans the
// financial statements are drawn for.
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
        subtitle: (p: Period) => (p.closed ? `closed on ${date(p.closed)}; nothing posts into it` : 'open: an entry dated in it posts'),
        properties: (p: Period) => [
          { label: 'State', value: open(p), kind: 'badge', tone: p.closed ? 'neutral' : 'accent' },
          { label: 'Closed on', value: p.closed, kind: 'date' },
        ],
        actions: Close,
      },
    },
    terms: {
      view: {
        group: 'finance',
        title: 'Capital terms',
        caption: 'The statutes’ capital clauses: a share’s value, what an associate subscribes, and how one who leaves is repaid',
        icon: icons.SealCheck,
        columns: [
          { key: 'from', label: 'From', kind: 'title', role: 'title', value: (t: Terms) => String(t.from) },
          { key: 'share', label: 'Share value', kind: 'money', role: 'sub', value: (t: Terms) => t.share },
          { key: 'minimum', label: 'Fewest shares', kind: 'number', role: 'hidden', value: (t: Terms) => t.minimum },
          { key: 'adopted', label: 'Adopted on', kind: 'date', role: 'hidden', value: (t: Terms) => t.adopted },
          { key: 'state', label: 'State', kind: 'badge', role: 'meta', value: adopted, tone: (t: Terms) => (t.adopted ? 'positive' : 'accent') },
        ],
      },
      page: {
        eyebrow: 'Capital terms',
        title: (t: Terms) => `Capital terms from ${t.from}`,
        subtitle: (t: Terms) => (t.adopted ? `adopted on ${date(t.adopted)}` : 'drafted: adopted once the members decide'),
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
    reports: {
      view: {
        group: 'finance',
        title: 'Financial statements',
        caption: 'The income statement and the balance sheet, by month, quarter and year',
        icon: icons.ChartLine,
        columns: [
          { key: 'id', label: 'Span', kind: 'title', role: 'title', value: (r: Report) => r.id },
          { key: 'kind', label: 'Kind', kind: 'badge', role: 'hidden', value: (r: Report) => r.kind },
          { key: 'since', label: 'From', kind: 'date', role: 'hidden', value: (r: Report) => r.since },
          { key: 'until', label: 'To', kind: 'date', role: 'hidden', value: (r: Report) => r.until },
          { key: 'state', label: 'State', kind: 'badge', role: 'meta', value: closed, tone: (r: Report) => (r.closed ? 'neutral' : 'accent') },
        ],
        look: { layout: 'table' },
      },
      page: {
        eyebrow: 'Financial statements',
        title: (r: Report) => `${kinds[r.kind]} ${r.id}`,
        subtitle: (r: Report) => `${date(r.since)} to ${date(r.until)}, against ${r.before}${r.closed ? '' : '; open, so its figures may still change'}`,
        properties: (r: Report) => [
          { label: 'State', value: closed(r), kind: 'badge', tone: r.closed ? 'neutral' : 'accent' },
          { label: 'From', value: r.since, kind: 'date' },
          { label: 'To', value: r.until, kind: 'date' },
          { label: 'Against', value: r.before, href: r.earlier ? `/reports/${r.before}` : undefined },
        ],
      },
    },
  },
}
