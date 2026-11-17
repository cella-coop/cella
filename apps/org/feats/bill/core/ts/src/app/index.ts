import { icons, type App, type Tone } from '@cella/org-ui'
import { categories, type Detail, type Listed } from '../models/bill.ts'
import Lines from './blocks/Lines.svelte'
import Record from './blocks/Record.svelte'
import Status from './blocks/Status.svelte'
import Body from './blocks/Body.svelte'

const tones: { [s in Listed['standing']]: Tone } = { recorded: 'accent', approved: 'accent', paid: 'positive', overdue: 'warning' }
const category = (b: Listed) => categories.find((c) => c.code === b.category)?.label ?? b.category

// The feat's client side: the bills, a new one recorded with its lines,
// and a bill's page with its next write, its lines and its VAT by rate in
// a tab of their own.
export const app: App = {
  name: 'bill',
  collections: {
    bills: {
      view: {
        title: 'Bills',
        caption: 'What suppliers bill the co-op, approved within a mandate and paid from the bank',
        icon: icons.Receipt,
        create: Record,
        columns: [
          { key: 'supplier', label: 'Supplier', kind: 'title', role: 'title', value: (b: Listed) => b.supplier },
          { key: 'label', label: 'For', role: 'sub', value: (b: Listed) => b.label },
          { key: 'id', label: 'Id', kind: 'mono', role: 'hidden', value: (b: Listed) => b.id },
          { key: 'reference', label: 'Their reference', kind: 'mono', role: 'hidden', value: (b: Listed) => b.reference },
          { key: 'category', label: 'Category', kind: 'badge', role: 'hidden', value: (b: Listed) => b.category },
          { key: 'due', label: 'Due', kind: 'date', role: 'meta', value: (b: Listed) => b.due },
          { key: 'total', label: 'Total', kind: 'money', role: 'meta', value: (b: Listed) => b.total },
          { key: 'standing', label: 'Status', kind: 'badge', role: 'meta', value: (b: Listed) => b.standing, tone: (b: Listed) => tones[b.standing] },
          { key: 'net', label: 'Before VAT', kind: 'money', role: 'hidden', value: (b: Listed) => b.net },
          { key: 'vat', label: 'VAT', kind: 'money', role: 'hidden', value: (b: Listed) => b.vat },
          { key: 'issued', label: 'Dated', kind: 'date', role: 'hidden', value: (b: Listed) => b.issued },
          { key: 'recorded', label: 'Recorded', kind: 'date', role: 'hidden', value: (b: Listed) => b.recorded },
          { key: 'circle', label: 'Circle', kind: 'circle', role: 'hidden', value: (b: Listed & { circle?: string | null }) => b.circle },
        ],
        // The approval queue first: grouped by standing, the soonest due
        // first.
        look: { by: 'standing', sort: { field: 'due', dir: 'asc' }, lanes: { standing: ['overdue', 'recorded', 'approved', 'paid'] } },
        dashboard: [
          { kind: 'kpi', title: 'To approve', measure: { op: 'sum', field: 'total' }, where: [{ field: 'standing', is: ['recorded'] }] },
          { kind: 'kpi', title: 'To pay', measure: { op: 'sum', field: 'total' }, where: [{ field: 'standing', is: ['approved'] }] },
          { kind: 'kpi', title: 'Overdue', measure: { op: 'sum', field: 'total' }, where: [{ field: 'standing', is: ['overdue'] }] },
          { kind: 'chart', title: 'By month', measure: { op: 'sum', field: 'total' }, by: 'issued' },
          { kind: 'chart', title: 'By category', measure: { op: 'sum', field: 'total' }, by: 'category' },
        ],
      },
      page: {
        eyebrow: 'Bill',
        title: (b: Detail) => b.supplier,
        subtitle: (b: Detail) => b.id,
        properties: (b: Detail) => [
          { label: 'Status', value: b.standing, kind: 'badge', tone: tones[b.standing] },
          { label: 'For', value: b.label },
          { label: 'Their reference', value: b.reference, kind: 'mono' },
          { label: 'Total', value: b.total, kind: 'money' },
          { label: 'Before VAT', value: b.net, kind: 'money' },
          { label: 'VAT', value: b.vat, kind: 'money' },
          { label: 'Category', value: `${category(b)}, ${b.category}` },
          { label: 'Dated', value: b.issued, kind: 'date' },
          { label: 'Due', value: b.due, kind: 'date', tone: b.standing === 'overdue' ? 'warning' : undefined },
        ],
        activity: (b: Detail) => [
          ...(b.paid ? [{ at: b.paid, text: 'paid' }] : []),
          ...(b.approved ? [{ at: b.approved, text: 'approved', who: b.approver ?? undefined }] : []),
          { at: b.recorded, text: 'recorded', who: b.recorder },
        ],
        tabs: [
          { id: 'overview', label: 'Overview' },
          { id: 'lines', label: 'Lines' },
          { id: 'postings', label: 'Postings' },
        ],
        blocks: [Body, { tab: 'lines', block: Lines }],
        actions: Status,
      },
    },
  },
}
