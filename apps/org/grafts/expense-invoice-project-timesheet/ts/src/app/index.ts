import type { App, Tone } from '@cella/org-ui'
import type { Margin, Watch } from '../models/margin.ts'
import Margins from './blocks/Margin.svelte'

const tones: Record<Watch, Tone> = { 'on track': 'positive', 'budget spent': 'warning', 'over budget': 'negative', 'thin margin': 'warning' }
const watched = (m: Partial<Margin>) => !!m.watch && m.watch !== 'on track'

// The graft's client side: each project's margin, its margin percent, its
// budget burn, what its time cost and whether it is watched, as columns; the margins and the
// projects to watch on the projects' dashboard, and how many are watched
// as the collection's status; and on a project's overview, its margin
// against what it invoiced, its burn and its forecasts.
export const app: App = {
  name: 'expense-invoice-project-timesheet',
  extends: {
    projects: {
      columns: [
        { key: 'margin', label: 'Margin', kind: 'money', role: 'hidden', value: (r: Partial<Margin>) => r.margin ?? 0 },
        { key: 'percent', label: 'Margin %', kind: 'number', role: 'hidden', value: (r: Partial<Margin>) => r.percent },
        { key: 'burn', label: 'Burn %', kind: 'number', role: 'hidden', value: (r: Partial<Margin>) => r.burn },
        { key: 'cost', label: 'Time cost', kind: 'money', role: 'hidden', value: (r: Partial<Margin>) => r.cost ?? 0 },
        {
          key: 'watch',
          label: 'Watch',
          kind: 'badge',
          role: 'hidden',
          value: (r: Partial<Margin>) => r.watch ?? 'archived',
          tone: (r: Partial<Margin>) => (r.watch ? tones[r.watch] : 'neutral'),
        },
      ],
      status: (rows: Partial<Margin>[]) => {
        const n = rows.filter(watched).length
        return n ? { label: `${n} to watch`, tone: 'warning' } : undefined
      },
      dashboard: [
        { kind: 'kpi', title: 'Margin', measure: { op: 'sum', field: 'margin' } },
        { kind: 'kpi', title: 'Time cost', measure: { op: 'sum', field: 'cost' } },
        { kind: 'kpi', title: 'To watch', measure: { op: 'count' }, where: [{ field: 'watch', is: ['budget spent', 'over budget', 'thin margin'] }] },
        { kind: 'chart', title: 'Margin by watch', measure: { op: 'sum', field: 'margin' }, by: 'watch' },
      ],
      page: {
        properties: (m: Margin | null) =>
          m
            ? [
                { label: 'Margin', value: m.margin, kind: 'money', tone: m.margin < 0 ? 'negative' : undefined },
                { label: 'Watch', value: m.watch ?? 'archived', kind: 'badge', tone: m.watch ? tones[m.watch] : 'neutral' },
              ]
            : [],
        blocks: [Margins],
      },
    },
  },
}
