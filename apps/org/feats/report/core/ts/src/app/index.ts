import { icons, type App, type Column } from '@cella/org-ui'
import type { Margin } from '../models/margin.ts'
import type { Drawn, Report } from '../models/report.ts'
import type { Statement as Sheet } from '../models/statement.ts'
import type { Federation as Figures } from '../models/federation.ts'
import Save from './blocks/Save.svelte'
import Statement from './blocks/Statement.svelte'
import Margins from './blocks/Margins.svelte'
import Federation from './blocks/Federation.svelte'
import Custom from './blocks/Custom.svelte'

// The spans or years a page moves between: a statement's years and
// quarters, and the months of the year its span is in; the federation
// figures' distributed years.
function moves(d: Drawn): { label: string; sub?: string; href: string }[] {
  const at = (q: string) => `/reports/${d.report.id}?${q}`
  if ((d.report.kind === 'income' || d.report.kind === 'balance') && d.drawn) {
    const s = d.drawn as Sheet
    const year = s.span.id.slice(0, 4)
    return s.spans
      .filter((x) => x.kind !== 'month' || x.id.startsWith(year))
      .map((x) => ({ label: x.id, sub: x.id === s.span.id ? `${x.kind}, shown` : x.kind, href: at(`span=${x.id}`) }))
  }
  if (d.report.kind === 'federation' && d.drawn) {
    const f = d.drawn as Figures
    return f.years.map((y) => ({ label: String(y), sub: y === f.year ? 'shown' : 'distributed', href: at(`year=${y}`) }))
  }
  return []
}

// What a page says of the read it drew: the log's entry its snapshot was
// at, or why it drew nothing.
const read = (d: Drawn) => (d.failed ? d.failed : d.head ? `read at the log's entry ${d.head.n}` : '')

// The feat's client side: the saved reports, each page drawing its report
// through the port, and saving a member's own.
export const app: App = {
  name: 'report',
  collections: {
    reports: {
      view: {
        group: 'office',
        title: 'Reports',
        caption: 'The financial statements, the project margins, the federation figures and the members’ own, read through the analytics shell',
        icon: icons.ChartLine,
        create: Save,
        columns: [
          { key: 'title', label: 'Report', kind: 'title', role: 'title', value: (r: Report) => r.title },
          { key: 'caption', label: 'About', role: 'sub', value: (r: Report) => r.caption },
          { key: 'kind', label: 'Kind', kind: 'badge', role: 'meta', value: (r: Report) => r.kind, tone: (r: Report) => (r.kind === 'custom' ? 'accent' : 'neutral') },
          { key: 'owner', label: 'Saved by', role: 'hidden', value: (r: Report) => r.owner },
          { key: 'saved', label: 'Saved on', kind: 'date', role: 'hidden', value: (r: Report) => r.saved },
        ],
        look: { layout: 'table' },
      },
      page: {
        eyebrow: 'Report',
        title: (d: Drawn) => d.report.title,
        subtitle: (d: Drawn) => [d.report.caption, read(d)].filter(Boolean).join('; '),
        properties: (d: Drawn) => [
          { label: 'Kind', value: d.report.kind, kind: 'badge' },
          { label: 'Read at entry', value: d.head?.n ?? null, kind: 'number' },
          ...(d.report.owner ? [{ label: 'Saved by', value: d.report.owner }, { label: 'Saved on', value: d.report.saved, kind: 'date' as const }] : []),
        ],
        related: moves,
        blocks: [Statement, Margins, Federation, Custom],
      },
    },
  },
}

// The reports whose rows the home may pin a widget over, as the
// collection `reports/<id>`, and the fields of their rows: each project's
// margin.
export const pinnable: Record<string, { title: string; columns: Column<Margin>[] }> = {
  margins: {
    title: 'Project margins',
    columns: [
      { key: 'title', label: 'Project', kind: 'title', value: (m) => m.title },
      { key: 'invoiced', label: 'Invoiced', kind: 'money', value: (m) => m.invoiced },
      { key: 'cost', label: 'Time cost', kind: 'money', value: (m) => m.cost },
      { key: 'expenses', label: 'Expenses', kind: 'money', value: (m) => m.expenses },
      { key: 'margin', label: 'Margin', kind: 'money', value: (m) => m.margin },
      { key: 'percent', label: 'Margin %', kind: 'number', value: (m) => m.percent },
      { key: 'burn', label: 'Burn %', kind: 'number', value: (m) => m.burn },
      { key: 'landing', label: 'Margin at completion', kind: 'money', value: (m) => m.landing },
      { key: 'watch', label: 'Watch', kind: 'badge', value: (m) => m.watch },
    ],
  },
}
