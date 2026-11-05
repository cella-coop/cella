import type { Analytics, Head } from '@cella/org-analytics'
import type { Gathered, Rubric, Span, Statement } from '../models/statement.ts'

type Sheet = Statement['sheet']

const order = ['year', 'quarter', 'month']

// The spans of the books, the latest ending first, and of those ending on
// one day, the year, then the quarter, then the month.
export async function spans(port: Analytics): Promise<Span[]> {
  const { rows } = await port.run({
    from: { s: 'account.spans' },
    fields: ['s.id', 's.kind', 's.since', 's.until', 's.before', 's.before_since', 's.before_until', 's.closed'],
  })
  return rows
    .map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k.slice(2), v])) as unknown as Span)
    .sort((a, b) => b.until.localeCompare(a.until) || order.indexOf(a.kind) - order.indexOf(b.kind))
}

// The span a page draws: the one the address names, else the year the
// scope's day is in, else the latest.
export const chosen = (all: Span[], asked: string | null, today: string): Span | undefined =>
  all.find((s) => s.id === asked) ?? all.find((s) => s.kind === 'year' && s.since <= today && today <= s.until) ?? all[0]

// A sheet over a span against the span before it, read in one run: the
// journal by account and month, each account placed in its rubric on the
// sheet and named by the chart; then the sheet's rubrics and how each
// total expands down to its lines. A line's figure is the sum of its
// accounts', signed by its rubric's side; a total's, its lines times their
// signs; a heading's, none. The income statement sums the months within a
// span, the balance sheet every month up to its end.
export async function statement(port: Analytics, sheet: Sheet, span: Span): Promise<{ head: Head; rubrics: Rubric[] }> {
  const from = sheet === 'income' ? span.before_since : null
  const moved = await port.run({
    from: { m: 'account_transaction.movements', p: 'account.placements', c: 'account.chart' },
    join: [
      ['p.code', 'm.code'],
      ['c.code', 'm.code'],
    ],
    fields: ['p.rubric', 'm.code', 'c.label', 'm.month'],
    measures: { debit: { fn: 'sum', of: 'm.debit' }, credit: { fn: 'sum', of: 'm.credit' } },
    where: [{ field: 'p.sheet', op: '=', value: sheet }, { field: 'm.day', op: '<=', value: span.until }, ...(from ? [{ field: 'm.day', op: '>=' as const, value: from }] : [])],
  })
  // The rubrics are shared by id, so a report filters them by nothing
  // else: the sheet's are kept here.
  const registry = await port.run({
    from: { r: 'account.rubrics' },
    fields: ['r.id', 'r.sheet', 'r.n', 'r.kind', 'r.label', 'r.side'],
    order: ['r.n'],
  })
  const shape = registry.rows.filter((r) => r['r.sheet'] === sheet)
  const expands = await port.run({
    from: { t: 'account.totals' },
    fields: ['t.total', 't.line', 't.sign'],
    where: [{ field: 't.sheet', op: '=', value: sheet }],
  })
  const side = new Map(shape.map((r) => [r['r.id'] as string, r['r.side'] as string | null]))
  // Which column a month falls in: the span's, the span's before, or none.
  const columns = [span, { since: span.before_since, until: span.before_until }]
  const within = (month: string, c: { since: string; until: string }) =>
    month <= c.until.slice(0, 7) && (sheet === 'balance' || month >= c.since.slice(0, 7))
  const lines = new Map<string, Map<string, Gathered>>()
  for (const r of moved.rows) {
    const rubric = r['p.rubric'] as string
    const code = r['m.code'] as string
    const signed = side.get(rubric) === 'debit' ? Number(r.debit) - Number(r.credit) : Number(r.credit) - Number(r.debit)
    const accounts = lines.get(rubric) ?? new Map<string, Gathered>()
    const g = accounts.get(code) ?? { code, label: (r['c.label'] as string) ?? code, href: `/accounts/${code}`, amounts: [0, 0] }
    columns.forEach((c, i) => {
      if (within(r['m.month'] as string, c)) {
        g.amounts[i] += signed
      }
    })
    accounts.set(code, g)
    lines.set(rubric, accounts)
  }
  const line = (id: string) => [...(lines.get(id)?.values() ?? [])].reduce((s, g) => [s[0] + g.amounts[0], s[1] + g.amounts[1]], [0, 0])
  const parts = new Map<string, { line: string; sign: number }[]>()
  for (const t of expands.rows) {
    parts.set(t['t.total'] as string, [...(parts.get(t['t.total'] as string) ?? []), { line: t['t.line'] as string, sign: Number(t['t.sign']) }])
  }
  const rubrics = shape.flatMap((r): Rubric[] => {
    const id = r['r.id'] as string
    const kind = r['r.kind'] as Rubric['kind']
    const label = r['r.label'] as string
    if (kind === 'heading') {
      return [{ id, kind, label, amounts: [null, null] }]
    }
    if (kind === 'total') {
      const sum = (i: number) => (parts.get(id) ?? []).reduce((s, p) => s + p.sign * line(p.line)[i], 0)
      return [{ id, kind, label, amounts: [sum(0), sum(1)] }]
    }
    const accounts = [...(lines.get(id)?.values() ?? [])].sort((x, y) => x.code.localeCompare(y.code))
    return accounts.length ? [{ id, kind, label, amounts: line(id), accounts }] : []
  })
  return { head: moved.head, rubrics }
}
