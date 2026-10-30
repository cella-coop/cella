import { measures, type Db, type Keep, type Measure, type Source } from '@cella/org-db'
import { PAGE, result, type Field, type Result, type Spec, type Widget, type Where } from '@cella/org-ui/models'

// How many rows a list, a table or a gallery draws at most: "Show more"
// asks for the next page in the address (`n`).
const MOST = 5000

// How many rows the address asks to draw.
export const drawn = (url: URL): number => {
  const n = Number(url.searchParams.get('n'))
  return Number.isInteger(n) && n > PAGE ? Math.min(n, MOST) : PAGE
}

// The rows a view keeps: its conditions, and its text filter over every
// column the collection shows.
export const keeping = (spec: Pick<Spec, 'where' | 'q'>, fs: Field[]): Keep => ({
  where: spec.where,
  ...(spec.q.trim() ? { q: { text: spec.q, keys: fs.map((f) => f.key) } } : {}),
})

// A widget as the server measures it over a collection's rows: its own
// conditions after those of the rows it runs over, and, for a chart, what
// it groups by, a date by its month.
const measure = (w: Widget, where: Where[], fs: Field[]): Measure => ({
  where: [...where, ...(w.where ?? [])],
  op: w.measure.op,
  ...(w.measure.field ? { field: w.measure.field } : {}),
  ...(w.kind === 'chart' ? { by: { field: w.by, month: fs.find((f) => f.key === w.by)?.type === 'date' } } : {}),
})

// A widget over a report's rows, which the port read: the rows its
// enumerations keep, counted, or a numeric field summed, averaged or at
// its least or greatest, by an enumeration's value for a chart.
export function tally(rows: Record<string, unknown>[], w: Widget, fs: Field[]): Result {
  const field = (key: string) => fs.find((f) => f.key === key)
  const kept = rows.filter((r) => (w.where ?? []).every((c) => !('is' in c) || c.is.includes(String(field(c.field)?.value(r) ?? ''))))
  const measure = (group: Record<string, unknown>[]): number | null => {
    if (w.measure.op === 'count') {
      return group.length
    }
    const f = field(w.measure.field ?? '')
    const xs = group.map((r) => f?.value(r)).filter((x): x is number => typeof x === 'number')
    if (!xs.length) {
      return null
    }
    const sum = xs.reduce((s, x) => s + x, 0)
    return { sum, avg: Math.round(sum / xs.length), min: Math.min(...xs), max: Math.max(...xs) }[w.measure.op]
  }
  if (w.kind === 'kpi') {
    return result(w, measure(kept), fs)
  }
  const groups = new Map<string, Record<string, unknown>[]>()
  for (const r of kept) {
    const label = String(field(w.by)?.value(r) ?? '')
    groups.set(label, [...(groups.get(label) ?? []), r])
  }
  return result(w, [...groups].map(([label, g]) => ({ label, value: measure(g) ?? 0 })), fs)
}

// Each widget over the rows `where` keeps, in one statement.
export async function run(db: Db, from: Source, ws: Widget[], where: Where[], fs: Field[]): Promise<Result[]> {
  const measured = await measures(
    db,
    from,
    ws.map((w) => measure(w, where, fs)),
  )
  return ws.map((w, i) => result(w, measured[i] ?? null, fs))
}
