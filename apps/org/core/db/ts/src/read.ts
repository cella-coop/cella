import type { Db } from './index.ts'

// A collection's rows as one SQL select, as the acting member sees them:
// the reader is `cella.reader()`, and the row-level policies decide the
// rest. `sql` selects `id`, as text, and each field under the key of the
// column that shows it, already as the column shows it, since conditions,
// the text filter and widgets read the field in SQL; `order` is the order
// it lists in, an ORDER BY over the columns `sql` selects.
export interface Read {
  sql: string
  order: string
}

// What one collection's rows are read from: its owner's select and those
// of the extensions that add rows of their own, in that order, and each
// extension's select of `id` and the fields it adds to that row.
export interface Source {
  rows: Read[]
  fields: string[]
}

// A condition on a row, as a view holds one: an enumeration among some of
// its values, or a date within the month or the year of the scope's day,
// `cella.verdict_date()`; or, as a calendar keeps the rows it places, a
// date on one of the days from `from` to `to`.
export type Condition =
  | { field: string; is: string[] }
  | { field: string; within: 'month' | 'year' }
  | { field: string; from: string; to: string }

// Which rows a read keeps: those meeting every condition and, where there
// is a text filter, holding it in one of `keys`, case aside.
export interface Keep {
  where: Condition[]
  q?: { text: string; keys: string[] }
}

// What a widget computes over the rows it keeps: how many, or a figure
// over a numeric field; grouped, for a chart, by an enumeration's values
// or by the month of a date.
export interface Measure extends Keep {
  op: 'count' | 'sum' | 'avg' | 'min' | 'max'
  field?: string
  by?: { field: string; month: boolean }
}

// One statement's text and its parameters, as they are added.
class Statement {
  params: unknown[] = []
  p(v: unknown): string {
    this.params.push(v)
    return `$${this.params.length}`
  }
}

// The rows as `r(src, at, row)`: each source's rows in its order, `row`
// the JSON of the owner's fields with every extension's merged over it,
// one join per extension, so the collection is one statement.
function rows(s: Source): string {
  const from = s.rows.length
    ? s.rows.map((r, i) => `SELECT ${i} AS src, row_number() OVER (ORDER BY ${r.order}) AS at, to_jsonb(x) AS row FROM (${r.sql}) x`).join('\n  UNION ALL\n  ')
    : `SELECT 0 AS src, 0::bigint AS at, NULL::jsonb AS row WHERE false`
  const merged = ['o.row', ...s.fields.map((_, i) => `coalesce(to_jsonb(e${i}) - 'id', '{}')`)].join(' || ')
  const joins = s.fields.map((f, i) => `LEFT JOIN (${f}) e${i} ON e${i}.id::text = o.row->>'id'`).join('\n  ')
  return `WITH o AS (\n  ${from}\n), r AS MATERIALIZED (\n  SELECT o.src, o.at, ${merged} AS row FROM o\n  ${joins}\n)`
}

// The SQL test of one condition; a field's value is as the row holds it
// under its key, the empty text where it has none.
function condition(st: Statement, c: Condition): string {
  if ('is' in c) {
    return `coalesce(row->>${st.p(c.field)}, '') = ANY(${st.p(c.is)}::text[])`
  }
  if ('from' in c) {
    return `left(row->>${st.p(c.field)}, 10) BETWEEN ${st.p(c.from)} AND ${st.p(c.to)}`
  }
  const n = c.within === 'month' ? 7 : 4
  return `left(row->>${st.p(c.field)}, ${n}) = left(cella.verdict_date()::text, ${n})`
}

function kept(st: Statement, k: Keep): string {
  const all = k.where.map((c) => condition(st, c))
  if (k.q?.text.trim() && k.q.keys.length) {
    all.push(`EXISTS (SELECT 1 FROM unnest(${st.p(k.q.keys)}::text[]) k WHERE strpos(lower(row->>k), lower(${st.p(k.q.text.trim())})) > 0)`)
  }
  return all.length ? all.join(' AND ') : 'true'
}

// What a page of a collection asks of its rows: those `keep` keeps, in
// the collection's order, `limit` of them after the first `offset` (all
// of them with no limit); how many each of `counts` keeps; and each of
// `values`' keys' values, sorted, the empty one left out, the choices an
// enumeration's editor offers. Each part is left out where it is not
// asked.
export interface Asked {
  keep?: Keep
  limit?: number
  offset?: number
  counts?: Keep[]
  values?: string[]
}

// What a page asks, read in one statement over the rows composed once.
export async function read(db: Db, s: Source, a: Asked): Promise<{ rows: { id: string }[]; counts: number[]; values: Record<string, string[]> }> {
  const st = new Statement()
  const parts: string[] = []
  if (a.keep) {
    const bounds = `${a.limit === undefined ? '' : ` LIMIT ${st.p(a.limit)}`}${a.offset ? ` OFFSET ${st.p(a.offset)}` : ''}`
    parts.push(`(SELECT coalesce(json_agg(row ORDER BY src, at), '[]') FROM (SELECT src, at, row FROM r WHERE ${kept(st, a.keep)} ORDER BY src, at${bounds}) p) AS rows`)
  }
  if (a.counts?.length) {
    parts.push(`(SELECT json_build_array(${a.counts.map((k) => `count(*) FILTER (WHERE ${kept(st, k)})`).join(', ')}) FROM r) AS counts`)
  }
  if (a.values?.length) {
    parts.push(
      `(SELECT coalesce(json_object_agg(k, vs), '{}') FROM (SELECT k, array_agg(DISTINCT v ORDER BY v) AS vs FROM r, unnest(${st.p(a.values)}::text[]) k, LATERAL (SELECT row->>k AS v) x WHERE v <> '' GROUP BY k) g) AS values`,
    )
  }
  const found = parts.length
    ? (await db.query<{ rows?: { id: string }[]; counts?: number[]; values?: Record<string, string[]> }>(`${rows(s)}\nSELECT ${parts.join(',\n  ')}`, st.params)).rows[0]
    : undefined
  return {
    rows: found?.rows ?? [],
    counts: found?.counts ?? [],
    values: { ...Object.fromEntries((a.values ?? []).map((k) => [k, []])), ...found?.values },
  }
}

// The rows a read keeps, in the collection's order, `limit` of them after
// the first `offset`; no limit reads them all.
export const page = async (db: Db, s: Source, keep: Keep, limit?: number, offset = 0) => (await read(db, s, { keep, limit, offset })).rows

// How many rows each of `keeps` keeps.
export const counts = async (db: Db, s: Source, keeps: Keep[]) => (await read(db, s, { counts: keeps })).counts

// Each of `keys`' values over the rows.
export const values = async (db: Db, s: Source, keys: string[]) => (await read(db, s, { values: keys })).values

// A field's number, where the row holds one under its key.
const number = (st: Statement, field: string) => {
  const key = st.p(field)
  return `CASE WHEN row->>${key} ~ '^-?[0-9]+(\\.[0-9]+)?$' THEN (row->>${key})::numeric END`
}

function figure(st: Statement, m: Measure): string {
  if (m.op === 'count' || !m.field) {
    return 'count(*)'
  }
  const v = number(st, m.field)
  return m.op === 'sum' ? `coalesce(sum(${v}), 0)` : m.op === 'avg' ? `round(avg(${v}))` : `${m.op}(${v})`
}

// Each measure over the rows, in one statement: a figure, or null where
// there is nothing to take it over, or, grouped, each group's label and
// figure. A date groups by its month and skips rows without one; an
// enumeration's rows without a value fall under "—".
export async function measures(db: Db, s: Source, ms: Measure[]): Promise<(number | null | { label: string; value: number }[])[]> {
  if (!ms.length) {
    return []
  }
  const st = new Statement()
  const each = ms.map((m, i) => {
    const where = kept(st, m)
    const value = figure(st, m)
    if (!m.by) {
      return `(SELECT ${value} FROM r WHERE ${where})::float8 AS m${i}`
    }
    const by = st.p(m.by.field)
    const label = m.by.month ? `left(row->>${by}, 7)` : `coalesce(row->>${by}, '—')`
    const skip = m.by.month ? ` AND coalesce(row->>${by}, '') <> ''` : ''
    return `(SELECT coalesce(json_agg(json_build_object('label', label, 'value', value) ORDER BY label), '[]') FROM (SELECT ${label} AS label, coalesce(${value}, 0)::float8 AS value FROM r WHERE ${where}${skip} GROUP BY 1) g) AS m${i}`
  })
  const { rows: found } = await db.query<Record<string, number | null | { label: string; value: number }[]>>(`${rows(s)}\nSELECT ${each.join(',\n  ')}`, st.params)
  return ms.map((_, i) => found[0]?.[`m${i}`] ?? null)
}

// The scope's day, as the notary dates a verdict (`cella.verdict_date()`,
// in the scope's timezone): what a page calls today.
export async function today(db: Db): Promise<string> {
  const { rows: found } = await db.query<{ day: string }>('SELECT cella.verdict_date()::text AS day')
  return found[0]?.day ?? ''
}

// A text from code as a SQL literal, for a select that maps its codes to
// the labels a column shows.
export const literal = (text: string) => `'${text.replaceAll("'", "''")}'`
