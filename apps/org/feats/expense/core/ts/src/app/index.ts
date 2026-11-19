import { icons, type App } from '@cella/org-ui'
import { categories, type Expense } from '../models/expense.ts'
import { status } from '../models/status.ts'
import Capture from './blocks/Capture.svelte'
import Claim from './blocks/Claim.svelte'
import Status from './blocks/Status.svelte'
import Body from './blocks/Body.svelte'

const category = (e: Expense) => categories.find((c) => c.code === e.category)?.label ?? e.category

// The feat's client side: the expenses as a board by status, on which a
// card dragged into the next column is that column's write; a new claim
// as the acting member; and an expense's page with its next write, which
// opens on its claim, its amounts and how far it has come, then its
// notes; its receipts and postings the tabs its extenders fill.
export const app: App = {
  name: 'expense',
  collections: {
    expenses: {
      view: {
        title: 'Expenses',
        caption: 'What members spent for the coop, approved within a mandate and paid back',
        icon: icons.Wallet,
        create: Capture,
        columns: [
          { key: 'label', label: 'Expense', kind: 'title', role: 'title', value: (e: Expense) => e.label },
          { key: 'id', label: 'Id', kind: 'mono', role: 'hidden', value: (e: Expense) => e.id },
          { key: 'category', label: 'Category', kind: 'badge', role: 'hidden', value: (e: Expense) => e.category },
          { key: 'day', label: 'Spent on', kind: 'date', role: 'meta', value: (e: Expense) => e.day },
          { key: 'total', label: 'Amount', kind: 'money', role: 'meta', value: (e: Expense) => e.total },
          { key: 'status', label: 'Status', kind: 'status', states: status, role: 'meta', value: (e: Expense) => e.status },
          { key: 'net', label: 'Before VAT', kind: 'money', role: 'hidden', value: (e: Expense) => e.net },
          { key: 'vat', label: 'VAT', kind: 'money', role: 'hidden', value: (e: Expense) => e.vat },
          { key: 'decided', label: 'Decided', kind: 'date', role: 'hidden', value: (e: Expense) => e.decided },
          { key: 'member', label: 'Member', kind: 'person', role: 'hidden', value: (e: Expense) => e.member },
          { key: 'circle', label: 'Circle', kind: 'circle', role: 'hidden', value: (e: Expense & { circle?: string | null }) => e.circle },
        ],
        // A board by status, whose moves are the writes; the latest spent
        // first, each card naming who spent it, how much and when.
        look: { layout: 'board', by: 'status', sort: { field: 'day', dir: 'desc' }, cards: ['member', 'total', 'day'] },
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
        layout: 'panels',
        body: Body,
        blocks: [Claim],
        eyebrow: 'Expense',
        title: (e: Expense) => e.label,
        subtitle: (e: Expense) => e.id,
        // The day it was spent is the Claim panel's header's.
        properties: (e: Expense) => [
          { label: 'Status', value: e.status, kind: 'status', states: status },
          { label: 'Category', value: `${category(e)}, ${e.category}`, kind: 'badge' },
          { label: 'Receipt', value: e.receipt, kind: 'mono', glyph: icons.Paperclip, lead: 'receipt' },
          { label: 'Member', value: e.member, kind: 'person', href: `/people/${e.member}` },
          { label: 'Decided by', value: e.decider, kind: 'person', href: e.decider ? `/people/${e.decider}` : undefined, lead: e.status === 'refused' ? 'refused by' : 'approved by' },
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
