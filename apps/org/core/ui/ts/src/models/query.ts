import type { Column, Kind } from './view.ts'

// What a collection's rows can be asked: its fields, typed from the columns
// it declares, and the plain objects a view or a dashboard is made of.
// The server checks every such object against the fields before it runs
// one, so a viewer's configuration only ever names declared fields and
// known operations. Plain JSON, so a configuration can move from a
// viewer's address bar into a member's or a circle's preferences.

export type Type = 'number' | 'money' | 'date' | 'enum' | 'text'

export interface Field {
  key: string
  label: string
  type: Type
  value: (row: any) => unknown
}

const types: Partial<Record<Kind, Type>> = { money: 'money', number: 'number', date: 'date', badge: 'enum' }

export const fields = (columns: Column[]): Field[] =>
  columns.map((c) => ({ key: c.key, label: c.label, type: (c.kind && types[c.kind]) ?? 'text', value: c.value }))

export const numeric = (f: Field) => f.type === 'number' || f.type === 'money'

export const ops = ['count', 'sum', 'avg', 'min', 'max'] as const
export type Op = (typeof ops)[number]

// What a widget computes: how many rows, or a figure over a numeric field.
export interface Measure {
  op: Op
  field?: string
}

// A condition on a row: an enumeration among some of its values, or a date
// within the current month or year.
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
  if (f.type === 'enum') {
    const is = x.is
    if (!Array.isArray(is) || is.length === 0 || is.length > limits.values || !is.every((v) => typeof v === 'string' && v.length <= limits.value)) {
      throw new Error(`a condition on ${f.key} lists the values it keeps`)
    }
    return { field: f.key, is: [...is] }
  }
  if (f.type === 'date') {
    if (x.within !== 'month' && x.within !== 'year') {
      throw new Error(`a condition on ${f.key} keeps the current month or year`)
    }
    return { field: f.key, within: x.within }
  }
  throw new Error(`${f.key} is ${f.type}: a condition is on an enumeration or a date`)
}

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

// Whether a row meets every condition; `today` is an ISO day.
export function matches(row: any, ws: Where[], fs: Field[], today: string): boolean {
  return ws.every((w) => {
    const f = fs.find((f) => f.key === w.field)
    const v = f?.value(row)
    if ('is' in w) {
      return w.is.includes(String(v ?? ''))
    }
    if (!v) {
      return false
    }
    return String(v).slice(0, w.within === 'month' ? 7 : 4) === today.slice(0, w.within === 'month' ? 7 : 4)
  })
}

export type Format = 'number' | 'money'

export interface Figure {
  kind: 'kpi'
  title: string
  format: Format
  value: number | null
}

export interface Plot {
  kind: 'chart'
  title: string
  format: Format
  // Bars over an enumeration's values, or a line over months.
  line: boolean
  points: { label: string; value: number }[]
}

export type Result = Figure | Plot

function compute(rows: any[], m: Measure, fs: Field[]): number | null {
  if (m.op === 'count') {
    return rows.length
  }
  const f = fs.find((f) => f.key === m.field)
  const xs = rows.map((r) => f?.value(r)).filter((v) => v !== null && v !== undefined && v !== '').map(Number).filter((n) => !Number.isNaN(n))
  if (m.op === 'sum') {
    return xs.reduce((s, n) => s + n, 0)
  }
  if (!xs.length) {
    return null
  }
  if (m.op === 'avg') {
    return Math.round(xs.reduce((s, n) => s + n, 0) / xs.length)
  }
  return m.op === 'min' ? Math.min(...xs) : Math.max(...xs)
}

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

// Each widget over the rows, which the server runs on checked widgets.
export function aggregate(ws: Widget[], rows: any[], fs: Field[], today: string): Result[] {
  return ws.map((w) => {
    const kept = rows.filter((r) => matches(r, w.where ?? [], fs, today))
    if (w.kind === 'kpi') {
      return { kind: 'kpi', title: w.title, format: format(w.measure, fs), value: compute(kept, w.measure, fs) }
    }
    const by = fs.find((f) => f.key === w.by)
    const line = by?.type === 'date'
    const groups = new Map<string, any[]>()
    for (const r of kept) {
      const v = by?.value(r)
      const label = line ? (v ? String(v).slice(0, 7) : '') : String(v ?? '—')
      if (line && !label) {
        continue
      }
      groups.set(label, [...(groups.get(label) ?? []), r])
    }
    const labels = line ? months([...groups.keys()]) : [...groups.keys()]
    const points = labels.map((label) => ({ label, value: groups.has(label) ? (compute(groups.get(label) ?? [], w.measure, fs) ?? 0) : 0 }))
    if (!line) {
      points.sort((a, b) => b.value - a.value)
    }
    return { kind: 'chart', title: w.title, format: format(w.measure, fs), line, points }
  })
}

export const layouts = ['list', 'table', 'dashboard'] as const
export type Layout = (typeof layouts)[number]

// How a collection is looked at: its layout, the conditions on its rows,
// the text filter, the table's hidden columns and the dashboard's
// widgets, null for the declared or derived ones.
export interface Spec {
  layout: Layout
  where: Where[]
  q: string
  hide: string[]
  widgets: Widget[] | null
}

// A view a collection declares beside its columns, such as invoices'
// Unpaid; not editable. `icon` names one of the UI core's marks.
export interface Preset {
  id: string
  name: string
  icon?: string
  layout?: Layout
  where?: Where[]
  hide?: string[]
  widgets?: Widget[]
}

// A view a viewer saved from what they were looking at: a preference of
// theirs, never a record of the co-op's.
export interface Custom {
  id: string
  name: string
  icon?: string
  spec: Spec
}

// Every custom view a viewer keeps, by collection; versioned, so it can
// move from the browser into a member's preferences as it is.
export interface Saved {
  v: 1
  views: Record<string, Custom[]>
}

export const all: Preset = { id: 'all', name: 'All' }

// The collection's presets, with All last unless it declares its own.
export const presets = (declared: Preset[] = []): Preset[] => (declared.some((p) => p.id === all.id) ? declared : [...declared, all])

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
// when it names none, its settings overridden by the address's own
// (`view`, `where`, `q`, `hide`, `w`), each checked against the fields.
// What fails a check falls back to the view's, and is said.
export function resolve(params: URLSearchParams, ps: Preset[], fs: Field[]): { id: string; spec: Spec; errors: string[] } {
  const asked = params.get('v')
  const preset = ps.find((p) => p.id === asked)
  const id = preset?.id ?? (asked && /^c-[\w-]{1,40}$/.test(asked) ? asked : all.id)
  const base = preset ?? ps.find((p) => p.id === id) ?? all
  const errors: string[] = []
  const layout = layouts.find((l) => l === params.get('view')) ?? base.layout ?? 'list'
  let where = base.where ?? []
  const w = json(params.get('where'))
  if (w !== undefined) {
    try {
      where = wheres(w, fs)
    } catch (e) {
      errors.push(`the view's conditions: ${(e as Error).message}`)
    }
  }
  let ws: Widget[] | null = base.widgets ?? null
  const raw = json(params.get('w'))
  if (raw !== undefined) {
    const checked = widgets(raw, fs)
    ws = checked.widgets
    errors.push(...checked.errors)
  }
  const keys = new Set(fs.map((f) => f.key))
  const hide = params.has('hide') ? (params.get('hide') ?? '').split(',').filter((k) => keys.has(k)) : (base.hide ?? [])
  return { id, spec: { layout, where, q: (params.get('q') ?? '').slice(0, 200), hide, widgets: ws }, errors }
}

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

// The address of a view: its id, and what its spec changes from its
// preset's, so a preset's own address is just `?v=<id>`; a custom view's
// carries its whole spec, for the server knows no custom view.
export function address(id: string, spec: Spec, preset?: Preset): string {
  const q = new URLSearchParams()
  if (id !== all.id) {
    q.set('v', id)
  }
  if (spec.layout !== (preset?.layout ?? 'list')) {
    q.set('view', spec.layout)
  }
  if (!same(spec.where, preset?.where ?? [])) {
    q.set('where', JSON.stringify(spec.where))
  }
  if (!same(spec.hide, preset?.hide ?? [])) {
    q.set('hide', spec.hide.join(','))
  }
  if (!same(spec.widgets, preset?.widgets ?? null)) {
    q.set('w', JSON.stringify(spec.widgets))
  }
  if (spec.q) {
    q.set('q', spec.q)
  }
  const s = q.toString()
  return s ? `?${s}` : '?'
}

// Whether two specs show the same thing.
export const alike = (a: Spec, b: Spec) => same(a, b)

// What a preset shows before the viewer changes anything.
export const spec = (p?: Preset): Spec => ({ layout: p?.layout ?? 'list', where: p?.where ?? [], q: '', hide: p?.hide ?? [], widgets: p?.widgets ?? null })

// A saved store as read back from the browser: anything unrecognised is
// dropped rather than trusted.
export function saved(x: unknown): Saved {
  const store: Saved = { v: 1, views: {} }
  if (typeof x !== 'object' || x === null || (x as Saved).v !== 1 || typeof (x as Saved).views !== 'object') {
    return store
  }
  for (const [name, list] of Object.entries((x as Saved).views ?? {})) {
    if (Array.isArray(list)) {
      store.views[name] = list.filter((c) => typeof c?.id === 'string' && /^c-[\w-]{1,40}$/.test(c.id) && typeof c.name === 'string' && typeof c.spec === 'object')
    }
  }
  return store
}
