import type { Field, Op, Widget } from '../models/query.ts'

// A widget as its form edits it: flat, one condition at most.
export interface Draft {
  kind: 'kpi' | 'chart'
  title: string
  op: Op
  field: string
  by: string
  on: string
  is: string[]
  within: 'month' | 'year'
}

// The dashboard's editor in the View panel's Display popover: which widget is open, a new
// one being -1, and its draft until it is saved into the address.
export class DashboardState {
  editing: number | null = $state(null)
  draft: Draft = $state(blank())

  open(i: number, w: Widget | undefined, fs: Field[]) {
    const where = w?.where?.[0]
    this.draft = {
      kind: w?.kind ?? 'kpi',
      title: w?.title ?? '',
      op: w?.measure.op ?? 'count',
      field: w?.measure.field ?? fs.find((f) => f.type === 'money' || f.type === 'number')?.key ?? '',
      by: w?.kind === 'chart' ? w.by : (fs.find((f) => f.type === 'enum' || f.type === 'date')?.key ?? ''),
      on: where?.field ?? '',
      is: where && 'is' in where ? [...where.is] : [],
      within: where && 'within' in where ? where.within : 'month',
    }
    this.editing = i
  }

  close() {
    this.editing = null
  }

  toggle(value: string) {
    this.draft.is = this.draft.is.includes(value) ? this.draft.is.filter((v) => v !== value) : [...this.draft.is, value]
  }

  // The draft as a widget, for the server to check against the fields.
  widget(fs: Field[]): Widget {
    const d = this.draft
    const measure = d.op === 'count' ? { op: d.op } : { op: d.op, field: d.field }
    const on = fs.find((f) => f.key === d.on)
    const where = on?.type === 'enum' ? [{ field: on.key, is: d.is }] : on?.type === 'date' ? [{ field: on.key, within: d.within }] : []
    const title = d.title.trim() || (d.kind === 'kpi' ? 'Figure' : 'Chart')
    const base = { title, measure, ...(where.length && (on?.type !== 'enum' || d.is.length) ? { where } : {}) }
    return d.kind === 'kpi' ? { kind: 'kpi', ...base } : { kind: 'chart', ...base, by: d.by }
  }
}

function blank(): Draft {
  return { kind: 'kpi', title: '', op: 'count', field: '', by: '', on: '', is: [], within: 'month' }
}
