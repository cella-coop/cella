import { icons, type App, type Tone } from '@cella/org-ui'
import { categories, statuses, type Expense, type Status as Stage } from '../models/expense.ts'
import Capture from './blocks/Capture.svelte'
import Status from './blocks/Status.svelte'
import Body from './blocks/Body.svelte'

const tones: Record<Stage, Tone> = { draft: 'neutral', submitted: 'accent', approved: 'accent', refused: 'negative', reimbursed: 'positive' }
const category = (e: Expense) => categories.find((c) => c.code === e.category)?.label ?? e.category

// The feat's client side: the expenses as a board by status, on which a
// card dragged into the next column is that column's write; a new claim
// as the acting member; and an expense's page with its next write, its
// receipts and postings the tabs its extenders fill.
export const app: App = {
  name: 'expense',
  collections: {
    expenses: {
      view: {
        title: 'Expenses',
        caption: 'What members spent for the co-op, approved within a mandate and paid back',
        icon: icons.Wallet,
        create: Capture,
        columns: [
          { key: 'label', label: 'Expense', kind: 'title', role: 'title', value: (e: Expense) => e.label },
          { key: 'id', label: 'Id', kind: 'mono', role: 'hidden', value: (e: Expense) => e.id },
          { key: 'category', label: 'Category', kind: 'badge', role: 'hidden', value: (e: Expense) => e.category },
          { key: 'day', label: 'Spent on', kind: 'date', role: 'meta', value: (e: Expense) => e.day },
          { key: 'total', label: 'Amount', kind: 'money', role: 'meta', value: (e: Expense) => e.total },
          { key: 'status', label: 'Status', kind: 'badge', role: 'meta', value: (e: Expense) => e.status, tone: (e: Expense) => tones[e.status] },
          { key: 'net', label: 'Before VAT', kind: 'money', role: 'hidden', value: (e: Expense) => e.net },
          { key: 'vat', label: 'VAT', kind: 'money', role: 'hidden', value: (e: Expense) => e.vat },
          { key: 'decided', label: 'Decided', kind: 'date', role: 'hidden', value: (e: Expense) => e.decided },
          { key: 'member', label: 'Member', kind: 'person', role: 'hidden', value: (e: Expense) => e.member },
          { key: 'circle', label: 'Circle', kind: 'circle', role: 'hidden', value: (e: Expense & { circle?: string | null }) => e.circle },
        ],
        // A board by status, whose moves are the writes; the latest spent
        // first, each card naming who spent it, how much and when.
        look: { layout: 'board', by: 'status', sort: { field: 'day', dir: 'desc' }, lanes: { status: [...statuses] }, cards: ['member', 'total', 'day'] },
        shifts: [
          { by: 'status', to: ['submitted'], action: 'submit' },
          { by: 'status', to: ['approved'], action: 'approve' },
          { by: 'status', to: ['refused'], action: 'refuse' },
          { by: 'status', to: ['reimbursed'], action: 'reimburse' },
        ],
        dashboard: [
          { kind: 'kpi', title: 'Awaiting approval', measure: { op: 'sum', field: 'total' }, where: [{ field: 'status', is: ['submitted'] }] },
          { kind: 'kpi', title: 'To reimburse', measure: { op: 'sum', field: 'total' }, where: [{ field: 'status', is: ['approved'] }] },
          { kind: 'kpi', title: 'Reimbursed', measure: { op: 'sum', field: 'total' }, where: [{ field: 'status', is: ['reimbursed'] }] },
          { kind: 'chart', title: 'By category', measure: { op: 'sum', field: 'total' }, by: 'category' },
          { kind: 'chart', title: 'By month', measure: { op: 'sum', field: 'total' }, by: 'day' },
        ],
      },
      page: {
        blocks: [Body],
        eyebrow: 'Expense',
        title: (e: Expense) => e.label,
        subtitle: (e: Expense) => e.id,
        properties: (e: Expense) => [
          { label: 'Status', value: e.status, kind: 'badge', tone: tones[e.status] },
          { label: 'Amount', value: e.total, kind: 'money' },
          { label: 'Before VAT', value: e.net, kind: 'money' },
          { label: 'VAT', value: e.vat, kind: 'money' },
          { label: 'Category', value: `${category(e)}, ${e.category}` },
          { label: 'Spent on', value: e.day, kind: 'date' },
          { label: 'Receipt', value: e.receipt, kind: 'mono' },
          { label: 'Member', value: e.member, kind: 'person', href: `/people/${e.member}` },
        ],
        activity: (e: Expense) => [
          ...(e.reimbursed ? [{ at: e.reimbursed, text: 'reimbursed' }] : []),
          ...(e.decided ? [{ at: e.decided, text: e.status === 'refused' ? 'refused' : 'approved', who: e.decider ?? undefined }] : []),
          ...(e.submitted ? [{ at: e.submitted, text: 'submitted' }] : []),
          { at: e.day, text: 'spent' },
        ],
        tabs: [
          { id: 'overview', label: 'Overview' },
          { id: 'receipts', label: 'Receipts' },
          { id: 'postings', label: 'Postings' },
        ],
        actions: Status,
      },
    },
  },
}
