import { icons, money, type App, type Tone } from '@cella/org-ui'
import type { Detail, Listed } from '../models/invoice.ts'
import Issue from './blocks/Issue.svelte'
import Lines from './blocks/Lines.svelte'
import Payments from './blocks/Payments.svelte'
import Send from './blocks/Send.svelte'
import { Body } from '@cella/org-body/app'

const standing = (i: Listed) => (i.overdue ? 'overdue' : i.state)
const tones: Record<string, Tone> = { overdue: 'warning', unpaid: 'accent', partial: 'accent', paid: 'positive', overpaid: 'warning', voided: 'neutral' }

// The feat's client side: the invoices, a new invoice, and an invoice's
// page, which opens on its panels: its lines and totals, then its
// payments and standing, then its notes; its postings in a tab.
export const app: App = {
  name: 'invoice',
  collections: {
    invoices: {
      view: {
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
          { key: 'total', label: 'Total', kind: 'money', role: 'hidden', value: (i: Listed) => i.total },
          { key: 'owed', label: 'Owed', kind: 'money', role: 'meta', value: (i: Listed) => i.owed },
          { key: 'due', label: 'Due', kind: 'date', role: 'meta', value: (i: Listed) => i.due },
          { key: 'state', label: 'Standing', kind: 'badge', role: 'meta', value: (i: Listed) => i.state, tone: (i: Listed) => tones[i.state] },
          { key: 'circle', label: 'Circle', kind: 'circle', role: 'hidden', value: (i: Listed & { circle?: string }) => i.circle },
        ],
        // Grouped by standing, overdue first, what someone acts on; the
        // soonest due first. Its calendar places each on the day it is due.
        look: { by: 'state', sort: { field: 'due', dir: 'asc' }, on: 'due', lanes: { state: ['overdue', 'partial', 'unpaid', 'paid', 'overpaid', 'voided'] } },
      },
      page: {
        eyebrow: 'Invoice',
        title: (i: Detail) => i.label,
        subtitle: (i: Detail) => i.id,
        // Who it bills, where a client's chip does not already name them;
        // its due day is the Payments panel's header's but once voided.
        properties: (i: Detail) => [
          { label: 'Bills', value: i.bill_to, glyph: icons.Receipt, lead: 'bills' },
          { label: 'Standing', value: standing(i), kind: 'badge', tone: tones[standing(i)] },
          { label: 'Issued', value: i.issued, kind: 'date' },
          ...(i.voided ? [{ label: 'Due', value: i.due, kind: 'date' as const }] : []),
          { label: 'Sent', value: i.sent, kind: 'date' },
          ...(i.bill_address ? [{ label: 'Billed at', value: i.bill_address.replaceAll('\n', ', '), glyph: icons.MapPinSimple }] : []),
          ...(i.voided ? [{ label: 'Voided', value: i.voided, kind: 'date' as const }, { label: 'Why', value: i.reason, glyph: icons.ChatCircle, lead: 'reason' }] : []),
        ],
        related: (i: Detail) => [{ label: 'Download PDF', sub: `${i.id}.pdf`, href: `/invoices/${i.id}/content` }],
        activity: (i: Detail) => [
          ...i.payments.map((p) => ({ at: p.at, text: `received ${money(p.amount)}, ${p.reference}` })),
          ...(i.voided ? [{ at: i.voided, text: 'voided' }] : []),
          ...(i.sent ? [{ at: i.sent, text: 'sent' }] : []),
          { at: i.issued, text: 'issued' },
        ],
        tabs: [
          { id: 'overview', label: 'Overview' },
          { id: 'postings', label: 'Postings' },
        ],
        layout: 'panels',
        body: Body,
        blocks: [Lines, Payments],
        actions: Send,
      },
    },
  },
}
