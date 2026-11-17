import type { Column, Kind, Prop } from './view.ts'
import { spans, type Span } from './calendar.ts'
import { inkOf } from './ink.ts'

// What a collection's rows can be asked: its fields, typed from the columns
// it declares, and the plain objects a view or a dashboard is made of.
// The server checks every such object against the fields before it runs
// one, so a viewer's configuration only ever names declared fields and
// known operations. Plain JSON, so a configuration can move from a
// viewer's address bar into a member's or a circle's preferences.

// A person's field holds their address and a circle's its id, each a type
// of its own, never text, so a view filters by who or which circle.
export type Type = 'number' | 'money' | 'date' | 'enum' | 'person' | 'circle' | 'text'

export interface Field {
  key: string
  label: string
  type: Type
  value: (row: any) => unknown
  // The column's kind and record, which its values are drawn by.
  kind?: Kind
  record?: string
}

const types: Partial<Record<Kind, Type>> = { money: 'money', number: 'number', date: 'date', badge: 'enum', priority: 'enum', person: 'person', circle: 'circle' }

export const fields = (columns: Column[]): Field[] =>
  columns.map((c) => ({ key: c.key, label: c.label, type: (c.kind && types[c.kind]) ?? 'text', value: c.value, kind: c.kind, record: c.record }))

// The four fields the core read gives every collection's rows from the
// log, which no slice declares: the dates and the actors of the first and
// the latest entries about the row, when it was created and last updated
// and by whom. Kept to the table, which shows them once a view does.
export const logged: Column[] = [
  { key: 'created', label: 'Created', kind: 'date', role: 'hidden', value: (r) => r.created },
  { key: 'updated', label: 'Updated', kind: 'date', role: 'hidden', value: (r) => r.updated },
  { key: 'created_by', label: 'Created by', kind: 'person', role: 'hidden', value: (r) => r.created_by },
  { key: 'updated_by', label: 'Updated by', kind: 'person', role: 'hidden', value: (r) => r.updated_by },
]

// A collection's columns and the logged fields after them, but where it
// has a field of the same key, as tasks' Created is their own.
export const logging = (columns: Column[]): Column[] => [...columns, ...logged.filter((l) => !columns.some((c) => c.key === l.key))]

// A record page's last properties: the logged fields as the log has them
// for the record, `made`, but those its slices' properties already name.
export const stamps = (made: Record<string, unknown> | null | undefined, props: Prop[]): Prop[] =>
  logged.filter((l) => !props.some((p) => p.label === l.label)).map((l) => ({ label: l.label, value: l.value(made ?? {}) ?? null, kind: l.kind }))

export const numeric = (f: Field) => f.type === 'number' || f.type === 'money'

export const ops = ['count', 'sum', 'avg', 'min', 'max'] as const
export type Op = (typeof ops)[number]

// What a widget computes: how many rows, or a figure over a numeric field.
export interface Measure {
  op: Op
  field?: string
}

// A condition on a row: a field among some of its values, whatever its
// type, or a date within the month or the year of the scope's day; the
// server tests it in SQL, on the value the row holds under the field's
// key.
export type Where = { field: string; is: string[] } | { field: string; within: 'month' | 'year' }

export interface Kpi {
  kind: 'kpi'
  title: string
  measure: Measure
  where?: Where[]
}

// A chart groups its rows by an enumeration, drawn as bars, or by the
// month of a date, drawn as a line.
export interface Chart {
  kind: 'chart'
  title: string
  measure: Measure
  by: string
  where?: Where[]
}

export type Widget = Kpi | Chart

// How many rows a list, a table or a gallery draws before it asks the
// server for more.
export const PAGE = 100

export const limits = { widgets: 12, title: 80, values: 24, value: 60 }

const object = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)

function field(fs: Field[], key: unknown, what: string): Field {
  const f = fs.find((f) => f.key === key)
  if (!f) {
    throw new Error(`${what} names no field of the collection: ${JSON.stringify(key)}`)
  }
  return f
}

export function where(x: unknown, fs: Field[]): Where {
  if (!object(x)) {
    throw new Error('a condition is an object')
  }
  const f = field(fs, x.field, 'a condition')
  if (f.type === 'date') {
    if (x.within !== 'month' && x.within !== 'year') {
      throw new Error(`a condition on ${f.key} keeps the current month or year`)
    }
    return { field: f.key, within: x.within }
  }
  const is = x.is
  if (!Array.isArray(is) || is.length === 0 || is.length > limits.values || !is.every((v) => typeof v === 'string' && v.length <= limits.value)) {
    throw new Error(`a condition on ${f.key} lists the values it keeps`)
  }
  return { field: f.key, is: [...is] }
}

// Whether a view's Filter offers a field: a date, or a field holding more
// than one value and at most `limits.values` across the rows the view's
// other conditions keep, `held` its values as the server read them, none
// where it holds more.
export const filtering = (f: Field, held: string[] | undefined) =>
  f.type === 'date' || ((held?.length ?? 0) > 1 && (held?.length ?? 0) <= limits.values)

export const wheres = (x: unknown, fs: Field[]): Where[] => {
  if (x === undefined) {
    return []
  }
  if (!Array.isArray(x) || x.length > limits.values) {
    throw new Error('conditions are a list')
  }
  return x.map((w) => where(w, fs))
}

function measure(x: unknown, fs: Field[]): Measure {
  if (!object(x) || !ops.includes(x.op as Op)) {
    throw new Error(`a measure's op is one of ${ops.join(', ')}`)
  }
  const op = x.op as Op
  if (op === 'count') {
    return { op }
  }
  const f = field(fs, x.field, `${op}`)
  if (!numeric(f)) {
    throw new Error(`${op} of ${f.key}, which is ${f.type}, not a number`)
  }
  return { op, field: f.key }
}

// One widget, checked against the fields; it throws saying what is wrong.
export function widget(x: unknown, fs: Field[]): Widget {
  if (!object(x)) {
    throw new Error('a widget is an object')
  }
  if (typeof x.title !== 'string' || !x.title.trim() || x.title.length > limits.title) {
    throw new Error(`a widget's title is text of at most ${limits.title} characters`)
  }
  const base = { title: x.title.trim(), measure: measure(x.measure, fs), ...(x.where === undefined ? {} : { where: wheres(x.where, fs) }) }
  if (x.kind === 'kpi') {
    return { kind: 'kpi', ...base }
  }
  if (x.kind === 'chart') {
    const by = field(fs, x.by, 'a chart')
    if (by.type !== 'enum' && by.type !== 'date') {
      throw new Error(`a chart groups by an enumeration or a date, and ${by.key} is ${by.type}`)
    }
    return { kind: 'chart', ...base, by: by.key }
  }
  throw new Error(`a widget is a kpi or a chart, not ${JSON.stringify(x.kind)}`)
}

// A dashboard's widgets, each checked; what fails is dropped and said.
export function widgets(x: unknown, fs: Field[]): { widgets: Widget[]; errors: string[] } {
  if (!Array.isArray(x)) {
    return { widgets: [], errors: ['a dashboard is a list of widgets'] }
  }
  const out: Widget[] = []
  const errors: string[] = []
  for (const w of x.slice(0, limits.widgets)) {
    try {
      out.push(widget(w, fs))
    } catch (e) {
      errors.push((e as Error).message)
    }
  }
  if (x.length > limits.widgets) {
    errors.push(`a dashboard holds at most ${limits.widgets} widgets`)
  }
  return { widgets: out, errors }
}

// What a dashboard shows when the collection or the viewer configured
// none: how many rows, the sum of the first amount of money, the rows by
// the first enumeration, and the money, or else the rows, by the month of
// the first date. A plain number may be an id, so no default sums one.
export function defaults(fs: Field[]): Widget[] {
  const amount = fs.find((f) => f.type === 'money')
  const sum: Measure = amount ? { op: 'sum', field: amount.key } : { op: 'count' }
  const enumeration = fs.find((f) => f.type === 'enum')
  const date = fs.find((f) => f.type === 'date')
  return [
    { kind: 'kpi', title: 'Count', measure: { op: 'count' } },
    ...(amount ? [{ kind: 'kpi' as const, title: amount.label, measure: sum }] : []),
    ...(enumeration ? [{ kind: 'chart' as const, title: `By ${enumeration.label.toLowerCase()}`, measure: { op: 'count' as const }, by: enumeration.key }] : []),
    ...(date ? [{ kind: 'chart' as const, title: `${amount?.label ?? 'Count'} by month, ${date.label.toLowerCase()}`, measure: sum, by: date.key }] : []),
  ]
}

export type Format = 'number' | 'money'

// Where a result's rows come from, on a dashboard over several
// collections: the collection, linking to it.
export interface From {
  label: string
  href: string
}

export interface Figure {
  kind: 'kpi'
  title: string
  format: Format
  value: number | null
  from?: From
}

export interface Plot {
  kind: 'chart'
  title: string
  format: Format
  // Bars over an enumeration's values, or a line over months.
  line: boolean
  points: { label: string; value: number }[]
  from?: From
}

export type Result = Figure | Plot

// Every month from the first to the last of some `YYYY-MM` labels, so a
// line runs through the months nothing happened in.
function months(labels: string[]): string[] {
  const sorted = labels.filter((l) => /^\d{4}-\d{2}$/.test(l)).sort()
  if (!sorted.length) {
    return []
  }
  const out: string[] = []
  const last = sorted[sorted.length - 1]
  const [y, m] = sorted[0].split('-').map(Number)
  for (let i = 0; out.length < 240; i++) {
    const label = `${y + Math.floor((m - 1 + i) / 12)}-${String(((m - 1 + i) % 12) + 1).padStart(2, '0')}`
    out.push(label)
    if (label === last) {
      break
    }
  }
  return out
}

const format = (m: Measure, fs: Field[]): Format => (m.op !== 'count' && fs.find((f) => f.key === m.field)?.type === 'money' ? 'money' : 'number')

// What a widget shows from what the server measured over the rows it
// keeps (`measures` in `@cella/org-db`): a figure, or a chart's groups,
// its bars by value, the largest first, and its line through every month
// from the first to the last.
export function result(w: Widget, measured: number | null | { label: string; value: number }[], fs: Field[]): Result {
  if (w.kind === 'kpi') {
    return { kind: 'kpi', title: w.title, format: format(w.measure, fs), value: typeof measured === 'number' ? measured : null }
  }
  const held = new Map((Array.isArray(measured) ? measured : []).map((g) => [g.label, g.value]))
  const line = fs.find((f) => f.key === w.by)?.type === 'date'
  const labels = line ? months([...held.keys()]) : [...held.keys()]
  const points = labels.map((label) => ({ label, value: held.get(label) ?? 0 }))
  if (!line) {
    points.sort((a, b) => b.value - a.value)
  }
  return { kind: 'chart', title: w.title, format: format(w.measure, fs), line, points }
}

export const layouts = ['list', 'table', 'gallery', 'board', 'calendar', 'dashboard'] as const
export type Layout = (typeof layouts)[number]

// A layout as a view, a URL or a browser's saved one named it: the feed
// is gone, folded into the list it always was, so a spec still naming it
// opens as a list rather than breaking.
export const asLayout = (raw: string | null | undefined): Layout | undefined => (raw === 'feed' ? 'list' : layouts.find((l) => l === raw))

// The order a view sorts its rows in: by one field, ascending or
// descending; the server reads them so, in SQL.
export interface Sort {
  field: string
  dir: 'asc' | 'desc'
}

// A sort as the address says it, `sort=<key>`, or `sort=-<key>` for
// descending, and back; a key that is no field is none.
export const sorting = (raw: string | null, fs: Field[]): Sort | null => {
  const desc = raw?.startsWith('-') ?? false
  const key = desc ? raw?.slice(1) : raw
  return key && fs.some((f) => f.key === key) ? { field: key, dir: desc ? 'desc' : 'asc' } : null
}
export const sortKey = (s: Sort | null): string => (s ? `${s.dir === 'desc' ? '-' : ''}${s.field}` : '')

// What a view groups its rows by: an enumeration, a person, a circle, or
// a date, by its month; and what a board's columns are, never months.
export const groupable = (f: Field) => f.type === 'enum' || f.type === 'person' || f.type === 'circle' || f.type === 'date'
export const laned = (f: Field) => groupable(f) && f.type !== 'date'

// The field a view groups its rows by: its own, which the collection's
// look gives it until a view changes it (`spec`), in every layout but a
// board. A board's rows group by nothing, never a month: the field its
// columns are, its own `columns`, else, migrated in code rather than in
// SQL, the one an older view's `by` named before a board had columns of
// its own; else the one the look names, else the first enumeration,
// else the first person or circle.
export const grouping = (s: Pick<Spec, 'layout' | 'by' | 'columns'>, fs: Field[], look: Look = {}): Field | undefined => {
  if (s.layout !== 'board') {
    return fs.find((f) => f.key === s.by && groupable(f))
  }
  const named = (key: string | null | undefined) => fs.find((f) => f.key === key && laned(f))
  return named(s.columns ?? s.by) ?? named(look.by) ?? fs.find((f) => f.type === 'enum') ?? fs.find(laned)
}

// A board's swimlanes: the field its rows group by, an enumeration, a
// person or a circle, never a date, each lane holding the whole set of
// columns. None for a single lane, the board as it always drew; and
// none while `columns` is unset, for `by` still means the field its
// columns migrate from (`grouping`), not this.
export const swimlane = (s: Pick<Spec, 'by' | 'columns'>, fs: Field[]): Field | undefined => (s.columns ? fs.find((f) => f.key === s.by && laned(f)) : undefined)

// The group a row falls under: the value it holds under the field's key,
// as text, a date's its month, `YYYY-MM`, the empty one where it holds
// none, as the server groups it.
export const under = (row: Record<string, unknown>, key: string, month = false): string => {
  const v = row[key]
  return v === null || v === undefined || v === '' ? '' : month ? String(v).slice(0, 7) : String(v)
}

// Whether the `i`th of rows read group by group opens a group: the first,
// or one under another value than the row before it.
export const opens = (rows: Record<string, unknown>[], i: number, key: string, month = false): boolean =>
  i === 0 || under(rows[i] ?? {}, key, month) !== under(rows[i - 1] ?? {}, key, month)

// A group's header wears its value's own ink, seeded by its name, as a
// record's icon elsewhere does (`Cell`): none holding no value, a
// month, or an enumeration with a tone of its own, which keeps its
// meaning instead; a record chip with none, as a project's, takes the
// ink even where it is drawn as a badge.
export const groupTint = (by: Column, value: string, month: boolean): number | null =>
  by.record && !by.tone && !month && value !== '' ? inkOf(value) : null

// How a list, a table and a gallery draw the rows grouped by a
// field: the column and how many rows each value holds across every
// page, a date's by its month; the values the viewer collapsed, by
// value, and what collapses one; and, where the collection offers New,
// what a group's + creates with.
export interface Grouping {
  by: Column
  counts: Record<string, number>
  month?: boolean
  collapsed: Set<string>
  oncollapse: (value: string) => void
  oncreate?: () => void
}

// How a collection is looked at: its layout, the conditions on its rows,
// the text filter, the table's hidden columns and its columns' order (the
// keys it moved; the rest follow as declared), the field the rows are
// sorted by and which way, null for the collection's own order, the
// enumeration, person or circle a list, a table, a gallery or a
// calendar groups by, null for none, and, on a board, the field its
// swimlanes group by, null for a single lane; the field a board's
// columns are, null to read it from `by` instead, as every board did
// before it had columns of its own (`grouping`); the fields a gallery's
// or a board's cards show, the date a calendar places the rows by and
// whether it shows a month or a week, and the dashboard's widgets, null
// for the declared or derived ones, and whether it reads across
// circles, every circle's rows the reader may read, dropping the lens.
// Which month or week a calendar shows is not
// the view's: it is where the viewer is, `at` in the address beside it.
export interface Spec {
  layout: Layout
  where: Where[]
  q: string
  hide: string[]
  order: string[]
  sort: Sort | null
  by: string | null
  columns: string | null
  cards: string[]
  on: string | null
  span: Span
  widgets: Widget[] | null
  across: boolean
}

// How a collection looks before a view changes it, as it declares: its
// layout, the field every layout groups its rows by (a date by its
// month; a board's columns, and a calendar's colours) and the order it
// sorts them in, its cards' fields, each
// enumeration's values in the order its board's columns take, an empty
// column included, the date its calendar places the rows by and its
// span, and the columns its table hides until a view shows them.
export interface Look {
  layout?: Layout
  hide?: string[]
  by?: string
  sort?: Sort
  // What breaks the ties of any sort, before the collection's read order,
  // as the inbox's since: never the view's, always the collection's.
  then?: Sort
  cards?: string[]
  lanes?: Record<string, string[]>
  on?: string
  span?: Span
}

// A board's columns: the declared order of the enumeration's values, then
// any other value its rows hold.
export const lanes = (look: Look, by: string, held: string[]): string[] => {
  const declared = look.lanes?.[by] ?? []
  return [...declared, ...held.filter((v) => !declared.includes(v))]
}

// A move between a board's columns that is a write: dropping a card from
// one of `from` (any, if none) into one of `to` on the board grouped by
// `by` runs the collection's write `action` on the card's item, as its
// page's button would. A column no move names takes no drop.
export interface Shift {
  by: string
  from?: string[]
  to: string[]
  action: string
}

// The write a drop makes, if the collection declares one.
export const shift = (shifts: Shift[], by: string | null, from: string, to: string): Shift | undefined =>
  from === to ? undefined : shifts.find((s) => s.by === by && s.to.includes(to) && (!s.from || s.from.includes(from)))

// A view a collection declares beside its columns, such as invoices'
// Unpaid; not editable. `icon` names one of the UI core's marks.
export interface Preset {
  id: string
  name: string
  icon?: string
  layout?: Layout
  where?: Where[]
  hide?: string[]
  order?: string[]
  sort?: Sort
  by?: string
  columns?: string
  cards?: string[]
  on?: string
  span?: Span
  widgets?: Widget[]
  across?: boolean
}

// A view a viewer saved from what they were looking at: a preference of
// theirs, never a record of the co-op's.
export interface Custom {
  id: string
  name: string
  icon?: string
  spec: Spec
}

// A view pinned under Pinned, the same in every circle: the collection
// and the view it pins, a preset's id or the viewer's own, with the name,
// mark and address it was last drawn with.
export interface Pin {
  collection: string
  view: string
  name: string
  icon?: string
  href: string
}

// Every custom view a viewer keeps, by collection, and the views they
// pinned, in their order; versioned, so it can move from the browser into
// a member's preferences as it is.
export interface Saved {
  v: 1
  views: Record<string, Custom[]>
  pins: Pin[]
}

export const all: Preset = { id: 'all', name: 'All' }

// The collection's presets, its default first: All, what a bare address
// shows, unless it declares its own All, then the others as declared.
export const presets = (declared: Preset[] = []): Preset[] => {
  const own = declared.find((p) => p.id === all.id) ?? all
  return [own, ...declared.filter((p) => p.id !== all.id)]
}

const json = (raw: string | null): unknown => {
  if (raw === null) {
    return undefined
  }
  try {
    return JSON.parse(raw)
  } catch {
    return Symbol('not JSON')
  }
}

// The view the address asks for: a preset or a custom view by `v`, All
// when it names none, over the collection's look, its settings
// overridden by the address's own (`view`, `where`, `q`, `hide`,
// `order`, `sort`, `by`, `cards`, `on`, `span`, `w`, `across`), each checked against the
// fields. What
// fails a check falls back to the view's, and is said.
export function resolve(params: URLSearchParams, ps: Preset[], fs: Field[], look: Look = {}): { id: string; spec: Spec; errors: string[] } {
  const asked = params.get('v')
  const preset = ps.find((p) => p.id === asked)
  const id = preset?.id ?? (asked && /^c-[\w-]{1,40}$/.test(asked) ? asked : all.id)
  const base = spec(preset ?? ps.find((p) => p.id === id) ?? all, look)
  const errors: string[] = []
  const layout = asLayout(params.get('view')) ?? base.layout
  let where = base.where
  const w = json(params.get('where'))
  if (w !== undefined) {
    try {
      where = wheres(w, fs)
    } catch (e) {
      errors.push(`the view's conditions: ${(e as Error).message}`)
    }
  }
  let ws: Widget[] | null = base.widgets
  const raw = json(params.get('w'))
  if (raw !== undefined) {
    const checked = widgets(raw, fs)
    ws = checked.widgets
    errors.push(...checked.errors)
  }
  const keys = new Set(fs.map((f) => f.key))
  const list = (name: 'hide' | 'order' | 'cards') =>
    params.has(name) ? [...new Set((params.get(name) ?? '').split(','))].filter((k) => keys.has(k)) : base[name]
  // An empty sort is the collection's own order.
  const sort = params.has('sort') ? sorting(params.get('sort'), fs) : base.sort && keys.has(base.sort.field) ? base.sort : null
  const groups = fs.filter(groupable).map((f) => f.key)
  const asks = params.get('by')
  // An empty `by` groups by nothing; none on a board means the first
  // enumeration, which the board chooses itself.
  const by = asks === '' ? null : asks && groups.includes(asks) ? asks : base.by && groups.includes(base.by) ? base.by : null
  // A board's columns, never a date; an empty `columns` names none, read
  // from `by` instead (`grouping`), as every board did before it had
  // columns of its own.
  const laneable = fs.filter(laned).map((f) => f.key)
  const asksColumns = params.get('columns')
  const columns = asksColumns === '' ? null : asksColumns && laneable.includes(asksColumns) ? asksColumns : base.columns && laneable.includes(base.columns) ? base.columns : null
  // None means the first date, which the calendar chooses itself.
  const dates = fs.filter((f) => f.type === 'date').map((f) => f.key)
  const placing = params.get('on')
  const on = placing && dates.includes(placing) ? placing : base.on && dates.includes(base.on) ? base.on : null
  const span = spans.find((s) => s === params.get('span')) ?? base.span
  const across = params.has('across') ? params.get('across') === '1' : base.across
  return {
    id,
    spec: { layout, where, q: (params.get('q') ?? '').slice(0, 200), hide: list('hide'), order: list('order'), sort, by, columns, cards: list('cards'), on, span, widgets: ws, across },
    errors,
  }
}

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

// A condition with the values it keeps in order, for comparing
// conditions by what they keep, not by the order they were picked in.
export const canon = (w: Where): Where => ('is' in w ? { field: w.field, is: [...w.is].sort() } : w)
const wheresame = (a: Where[] | undefined, b: Where[] | undefined) => {
  const c = (ws: Where[] | undefined) => (ws ?? []).map(canon).sort((x, y) => x.field.localeCompare(y.field))
  return same(c(a), c(b))
}

// The address of a view: its id, and what its spec changes from `base`,
// what the server resolves the id to (a preset's spec over the
// collection's look, or All's for a custom view), so a preset's own
// address is just `?v=<id>`; a custom view's carries its whole spec, for
// the server knows no custom view.
export function address(id: string, s: Spec, base: Spec): string {
  const q = new URLSearchParams()
  if (id !== all.id) {
    q.set('v', id)
  }
  if (s.layout !== base.layout) {
    q.set('view', s.layout)
  }
  if (!wheresame(s.where, base.where)) {
    q.set('where', JSON.stringify(s.where))
  }
  for (const name of ['hide', 'order', 'cards'] as const) {
    if (!same(s[name], base[name])) {
      q.set(name, s[name].join(','))
    }
  }
  if (!same(s.sort, base.sort)) {
    q.set('sort', sortKey(s.sort))
  }
  if (s.by !== base.by) {
    q.set('by', s.by ?? '')
  }
  if (s.columns !== base.columns) {
    q.set('columns', s.columns ?? '')
  }
  if (s.on && s.on !== base.on) {
    q.set('on', s.on)
  }
  if (s.span !== base.span) {
    q.set('span', s.span)
  }
  if (s.across !== base.across) {
    q.set('across', s.across ? '1' : '0')
  }
  if (!same(s.widgets, base.widgets)) {
    q.set('w', JSON.stringify(s.widgets))
  }
  if (s.q) {
    q.set('q', s.q)
  }
  const out = q.toString()
  return out ? `?${out}` : '?'
}

// Whether two specs show the same thing.
export const alike = (a: Spec, b: Spec) => wheresame(a.where, b.where) && same({ ...a, where: [] }, { ...b, where: [] })

// What a preset shows before the viewer changes anything, over the
// collection's look.
export const spec = (p?: Preset, look: Look = {}): Spec => ({
  layout: p?.layout ?? look.layout ?? 'list',
  where: p?.where ?? [],
  q: '',
  hide: p?.hide ?? look.hide ?? [],
  order: p?.order ?? [],
  sort: p?.sort ?? look.sort ?? null,
  by: p?.by ?? look.by ?? null,
  // Unset until a view names its own: a board's columns read from `by`
  // instead (`grouping`), as every board did before it had columns of
  // its own.
  columns: p?.columns ?? null,
  cards: p?.cards ?? look.cards ?? [],
  on: p?.on ?? look.on ?? null,
  span: p?.span ?? look.span ?? 'month',
  widgets: p?.widgets ?? null,
  across: p?.across ?? false,
})

// The columns in a view's order: the keys it moved first, then the rest
// as the collection declares them.
export function arranged<C extends { key: string }>(columns: C[], order: string[]): C[] {
  const moved = order.map((k) => columns.find((c) => c.key === k)).filter((c) => c !== undefined)
  return [...moved, ...columns.filter((c) => !order.includes(c.key))]
}

// A saved store as read back from the browser: anything unrecognised is
// dropped rather than trusted.
export function saved(x: unknown): Saved {
  const store: Saved = { v: 1, views: {}, pins: [] }
  if (typeof x !== 'object' || x === null || (x as Saved).v !== 1 || typeof (x as Saved).views !== 'object') {
    return store
  }
  for (const [name, list] of Object.entries((x as Saved).views ?? {})) {
    if (Array.isArray(list)) {
      store.views[name] = list
        .filter((c) => typeof c?.id === 'string' && /^c-[\w-]{1,40}$/.test(c.id) && typeof c.name === 'string' && typeof c.spec === 'object')
        .map((c) => ({ ...c, spec: { ...spec(), ...c.spec, layout: asLayout(c.spec?.layout) ?? 'list' } }))
    }
  }
  const pins: unknown = (x as Saved).pins
  if (Array.isArray(pins)) {
    store.pins = pins.filter(pinned).map((p) => ({ collection: p.collection, view: p.view, name: p.name, href: p.href, ...(typeof p.icon === 'string' ? { icon: p.icon } : {}) }))
  }
  return store
}

// Whether a pin read back from the browser is one: a collection by name,
// a view's id, a name, and an address on this origin, under its
// collection.
const pinned = (p: Pin): p is Pin =>
  typeof p?.collection === 'string' &&
  /^[\w-]{1,60}$/.test(p.collection) &&
  typeof p.view === 'string' &&
  /^[\w-]{1,60}$/.test(p.view) &&
  typeof p.name === 'string' &&
  typeof p.href === 'string' &&
  (p.href === `/${p.collection}` || p.href.startsWith(`/${p.collection}?`))
