import { argued, type Query } from '@cella/org-db'
import type { Analytics } from '@cella/org-analytics'

// A query a slice publishes in its analytical contract, as the web
// shell's `ask` serves it: run through the port, the reader's, as a report
// of its one view, its columns shown, its argument's columns filtered by
// equality, its order and its personal columns declared; each row by its
// columns' own names.
export async function published(analytics: Analytics, q: Query, arg: unknown): Promise<object[]> {
  const value = argued(q, arg)
  const field = (c: string) => `v.${c}`
  const { rows } = await analytics.run({
    from: { v: q.view },
    fields: q.columns.map(field),
    where: q.by.map((c) => ({ field: field(c), op: '=', value: value[c] })),
    order: q.order.map(field),
    personal: (q.personal ?? []).map(field),
  })
  return rows.map((r) => Object.fromEntries(q.columns.map((c) => [c, r[field(c)]])))
}
