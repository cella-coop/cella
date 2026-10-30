import type { Analytics, Head, Value } from '@cella/org-analytics'
import type { Margin, Margins, Watch } from '../models/margin.ts'

const n = (v: Value | undefined) => (v === null || v === undefined ? null : Number(v))

// Rounded as SQL's `round` rounds, half away from zero, to `places`.
const round = (x: number, places = 0) => (Math.sign(x) * Math.round(Math.abs(x) * 10 ** places)) / 10 ** places

// The threshold in force on a day: the latest from a day not after it.
export async function threshold(port: Analytics, day: string): Promise<Margins['threshold']> {
  const { rows } = await port.run({
    from: { t: 'report.thresholds' },
    fields: ['t.since', 't.burn', 't.margin'],
    where: [{ field: 't.since', op: '<=', value: day }],
    order: ['-t.since'],
    limit: 1,
  })
  return rows[0] ? { burn: Number(rows[0]['t.burn']), margin: Number(rows[0]['t.margin']) } : null
}

// A project's watch by the threshold, in this order: its burn past the
// threshold while under way, its spend at completion beyond its budget, a
// margin keeping less than the threshold of what it invoiced; none once
// archived.
export function watch(m: Omit<Margin, 'watch' | 'project' | 'title'>, elapsed: number | null, archived: boolean, t: Margins['threshold']): Margin['watch'] {
  if (archived) {
    return 'archived'
  }
  const w: Watch =
    t && m.burn !== null && m.burn >= t.burn && (elapsed ?? 0) < 1
      ? 'budget spent'
      : m.forecast !== null && m.budget !== null && m.forecast > m.budget
        ? 'over budget'
        : t && m.invoiced > 0 && (100 * m.margin) / m.invoiced < t.margin
          ? 'thin margin'
          : 'on track'
  return w
}

// Each project's margin on the scope's day, read in one run through the
// port: the project, its time's burn and forecast, and what it invoiced
// and spent, a project with neither meeting none.
export async function margins(port: Analytics): Promise<{ head: Head; margins: Margins }> {
  const { head, rows } = await port.run({
    from: { p: 'project.projects', f: 'project_timesheet.forecasts', i: 'invoice_project.totals', s: 'expense_project.totals' },
    join: [
      ['f.project', 'p.id'],
      ['i.project', 'p.id'],
      ['s.project', 'p.id'],
    ],
    outer: ['i', 's'],
    fields: ['p.id', 'p.title', 'p.archived', 'f.day', 'f.budget', 'f.spent', 'f.cost', 'f.burn', 'f.elapsed', 'f.forecast', 'i.net', 's.approved'],
    order: ['p.id'],
  })
  // The scope's day, which every forecast is reckoned on.
  const day = rows[0]?.['f.day'] as string | undefined
  const t = day ? await threshold(port, day) : null
  const projects = rows.map((r): Margin => {
    const invoiced = n(r['i.net']) ?? 0
    const cost = n(r['f.cost']) ?? 0
    const expenses = n(r['s.approved']) ?? 0
    const margin = invoiced - cost - expenses
    const budget = n(r['f.budget'])
    const elapsed = n(r['f.elapsed'])
    const figures = {
      invoiced,
      cost,
      expenses,
      margin,
      percent: invoiced > 0 ? round((100 * margin) / invoiced, 1) : null,
      budget,
      spent: n(r['f.spent']) ?? 0,
      burn: n(r['f.burn']),
      forecast: n(r['f.forecast']),
      landing: elapsed !== null && elapsed > 0 ? (budget ?? invoiced) - round((cost + expenses) / elapsed) : null,
    }
    return { project: r['p.id'] as string, title: r['p.title'] as string, ...figures, watch: watch(figures, elapsed, r['p.archived'] !== null, t) }
  })
  return { head, margins: { day: String(day ?? ''), threshold: t, projects } }
}
