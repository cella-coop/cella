import { icons, money, type App, type Tone } from '@cella/org-ui'
import type { Detail, Listed } from '../models/invoice.ts'
import Issue from './blocks/Issue.svelte'
import Lines from './blocks/Lines.svelte'
import Send from './blocks/Send.svelte'

const standing = (i: Listed) => (i.overdue ? 'overdue' : i.state)
const tones: Record<string, Tone> = { overdue: 'warning', unpaid: 'accent', partial: 'accent', paid: 'positive', overpaid: 'warning', voided: 'neutral' }

// The feat's client side: the invoices, a new invoice, and
// an invoice's page with its lines and payments.
export const app: App = {
  name: 'invoice',
  collections: {
    invoices: {
      view: {
        group: 'finance',
        title: 'Invoices',
        icon: icons.Receipt,
        create: Issue,
        dashboard: [
          { kind: 'kpi', title: 'Owed', measure: { op: 'sum', field: 'owed' }, where: [{ field: 'state', is: ['unpaid', 'partial', 'overdue'] }] },
          { kind: 'kpi', title: 'Overdue', measure: { op: 'sum', field: 'owed' }, where: [{ field: 'state', is: ['overdue'] }] },
          { kind: 'kpi', title: 'Invoiced this year', measure: { op: 'sum', field: 'total' }, where: [{ field: 'issued', within: 'year' }] },
          { kind: 'chart', title: 'Amounts by month', measure: { op: 'sum', field: 'total' }, by: 'issued' },
          { kind: 'chart', title: 'By standing', measure: { op: 'count' }, by: 'state' },
        ],
        columns: [
          { key: 'id', label: 'Invoice', kind: 'title', role: 'title', value: (i: Listed) => i.id },
          { key: 'bill_to', label: 'Bills', role: 'sub', value: (i: Listed) => i.bill_to },
          { key: 'label', label: 'Label', role: 'sub', value: (i: Listed) => i.label },
          { key: 'issued', label: 'Issued', kind: 'date', role: 'hidden', value: (i: Listed) => i.issued },
          { key: 'due', label: 'Due', kind: 'date', role: 'meta', value: (i: Listed) => i.due },
          { key: 'total', label: 'Total', kind: 'money', role: 'meta', value: (i: Listed) => i.total },
          { key: 'owed', label: 'Owed', kind: 'money', role: 'hidden', value: (i: Listed) => i.owed },
          { key: 'state', label: 'Standing', kind: 'badge', role: 'meta', value: standing, tone: (i: Listed) => tones[standing(i)] },
        ],
      },
      page: {
        eyebrow: 'Invoice',
        title: (i: Detail) => i.id,
        subtitle: (i: Detail) => `${i.bill_to} · ${i.label}`,
        properties: (i: Detail) => [
          { label: 'Standing', value: standing(i), kind: 'badge', tone: tones[standing(i)] },
          { label: 'Total', value: i.total, kind: 'money' },
          { label: 'Net', value: i.net, kind: 'money' },
          { label: 'VAT', value: i.vat, kind: 'money' },
          { label: 'Paid', value: i.paid, kind: 'money' },
          { label: 'Owed', value: i.owed, kind: 'money' },
          ...(i.credit ? [{ label: 'Credit owed back', value: i.credit, kind: 'money' as const }] : []),
          { label: 'Issued', value: i.issued, kind: 'date' },
          { label: 'Due', value: i.due, kind: 'date', tone: i.overdue ? 'warning' : undefined },
          { label: 'Sent', value: i.sent, kind: 'date' },
          ...(i.voided ? [{ label: 'Voided', value: i.voided, kind: 'date' as const }, { label: 'Why', value: i.reason }] : []),
        ],
        activity: (i: Detail) => [
          ...i.payments.map((p) => ({ at: p.at, text: `received ${money(p.amount)}, ${p.reference}` })),
          ...(i.voided ? [{ at: i.voided, text: 'voided' }] : []),
          ...(i.sent ? [{ at: i.sent, text: 'sent' }] : []),
          { at: i.issued, text: 'issued' },
        ],
        blocks: [Lines],
        actions: Send,
      },
    },
  },
}
