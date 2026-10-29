import { MAX_ROWS, type Catalog, type Column, type Filter, type Report, type Type, type Value } from './report.ts'

// A report the port refuses, with every reason it found.
export class Invalid extends Error {
  readonly reasons: string[]

  constructor(reasons: string[]) {
    super(`invalid report: ${reasons.join('; ')}`)
    this.reasons = reasons
  }
}

// What a column's type lets a report do with it: a number sums and
// compares, a text, a date and a flag compare, a document or a list is
// only shown.
type Kind = 'number' | 'text' | 'boolean' | 'date' | 'shown'

const kinds: Record<Type, Kind> = {
  bigint: 'number',
  integer: 'number',
  smallint: 'number',
  numeric: 'number',
  text: 'text',
  boolean: 'boolean',
  date: 'date',
  'timestamp with time zone': 'date',
  jsonb: 'shown',
  'text[]': 'shown',
}

const NAME = /^[a-z][a-z0-9_]*$/
const DATE = /^\d{4}-\d{2}-\d{2}([T ][0-9:.]+(Z|[+-]\d{2}(:?\d{2})?)?)?$/
const MAX_IN = 1000

const quote = (name: string) => `"${name.replaceAll('"', '""')}"`

// Every reason the catalog refuses a report, none when it may run.
export function check(report: Report, catalog: Catalog): string[] {
  const reasons: string[] = []
  const views = Object.entries(report.from ?? {})
  if (!views.length) {
    reasons.push('a report reads at least one view')
  }
  for (const [as, view] of views) {
    if (!NAME.test(as)) {
      reasons.push(`${as}: a view's name in a report is lowercase letters, digits and _`)
    }
    if (!Object.hasOwn(catalog, view)) {
      reasons.push(`${view} is no view the slices publish`)
    }
  }
  const personal = new Set(report.personal ?? [])
  const touched = new Set<string>()
  // The column a field names, or a reason it names none.
  const column = (field: string, use: string): Column | null => {
    const at = field.indexOf('.')
    const as = field.slice(0, at)
    const view = at > 0 ? report.from[as] : undefined
    if (!view || !Object.hasOwn(report.from, as)) {
      reasons.push(`${use} ${field}: no view of the report is named ${at > 0 ? as : field}`)
      return null
    }
    const columns = catalog[view]
    if (!columns) {
      return null
    }
    const name = field.slice(at + 1)
    if (!Object.hasOwn(columns, name)) {
      reasons.push(`${use} ${field}: ${view} shares no column ${name}`)
      return null
    }
    touched.add(field)
    return columns[name]
  }

  // How the views meet: each after the first joins one before it, on
  // fields of one kind, and none is read as a cross product.
  for (const pair of report.join ?? []) {
    if (!Array.isArray(pair) || pair.length !== 2) {
      reasons.push('a join is a pair of fields')
      continue
    }
    const [a, b] = pair
    const ca = column(a, 'join')
    const cb = column(b, 'join')
    const va = a.split('.')[0]
    const vb = b.split('.')[0]
    if (va === vb) {
      reasons.push(`join ${a} = ${b}: a join meets two views, not one with itself`)
      continue
    }
    if (ca && cb) {
      if (kinds[ca.type] === 'shown' || kinds[cb.type] === 'shown') {
        reasons.push(`join ${a} = ${b}: a ${kinds[ca.type] === 'shown' ? ca.type : cb.type} is only shown, never joined on`)
      } else if (kinds[ca.type] !== kinds[cb.type]) {
        reasons.push(`join ${a} = ${b}: ${ca.type} and ${cb.type} are not one kind`)
      }
    }
  }
  const order = views.map(([as]) => as)
  for (const as of report.outer ?? []) {
    if (!order.slice(1).includes(as)) {
      reasons.push(`outer ${as}: names no view of the report after the first`)
    }
  }
  for (const [i, as] of order.entries()) {
    const before = new Set(order.slice(0, i))
    const meets = (report.join ?? []).some(
      (p) => Array.isArray(p) && p.length === 2 && ((p[0].startsWith(`${as}.`) && before.has(p[1].split('.')[0])) || (p[1].startsWith(`${as}.`) && before.has(p[0].split('.')[0]))),
    )
    if (i > 0 && !meets && Object.hasOwn(catalog, report.from[as])) {
      reasons.push(`${as} (${report.from[as]}) joins no view before it: a report never reads a cross product`)
    }
  }

  // What each row shows.
  const fields = report.fields ?? []
  const measures = Object.entries(report.measures ?? {})
  if (!fields.length && !measures.length) {
    reasons.push('a report shows at least one field or measure')
  }
  if (new Set(fields).size !== fields.length) {
    reasons.push('a field is shown once')
  }
  for (const field of fields) {
    column(field, 'field')
  }
  for (const [name, m] of measures) {
    if (!NAME.test(name)) {
      reasons.push(`${name}: a measure's name is lowercase letters, digits and _`)
    }
    if (!['sum', 'count', 'min', 'max', 'avg'].includes(m?.fn)) {
      reasons.push(`measure ${name}: ${m?.fn} is no measure (sum, count, min, max, avg)`)
      continue
    }
    if (m.of === undefined) {
      if (m.fn !== 'count') {
        reasons.push(`measure ${name}: ${m.fn} measures a field`)
      }
      continue
    }
    const c = column(m.of, `measure ${name}`)
    if (!c) {
      continue
    }
    const kind = kinds[c.type]
    if ((m.fn === 'sum' || m.fn === 'avg') && kind !== 'number') {
      reasons.push(`measure ${name}: ${m.fn} of ${m.of}, a ${c.type}, which is no number`)
    } else if ((m.fn === 'min' || m.fn === 'max') && (kind === 'shown' || kind === 'boolean')) {
      reasons.push(`measure ${name}: ${m.fn} of ${m.of}, a ${c.type}, which has no order`)
    }
  }

  // Which rows it reads.
  for (const f of report.where ?? []) {
    filter(f, column(f.field, 'filter'), reasons)
  }

  // How it orders them: by what it shows.
  const shown = new Set([...fields, ...measures.map(([n]) => n)])
  for (const o of report.order ?? []) {
    const by = o.startsWith('-') ? o.slice(1) : o
    if (!shown.has(by)) {
      reasons.push(`order ${o}: a report orders by a field it shows or a measure`)
    }
  }
  const limit = report.limit
  if (limit !== undefined && !(Number.isInteger(limit) && limit >= 1 && limit <= MAX_ROWS)) {
    reasons.push(`limit ${limit}: a whole number from 1 to ${MAX_ROWS}`)
  }

  // Whom it reads about: every personal field declared, and only those.
  for (const field of touched) {
    const [as, name] = [field.slice(0, field.indexOf('.')), field.slice(field.indexOf('.') + 1)]
    if (catalog[report.from[as]]?.[name]?.personal && !personal.has(field)) {
      reasons.push(`${field} is personal: a report reading it declares it in personal`)
    }
  }
  for (const field of personal) {
    const [as, name] = [field.slice(0, field.indexOf('.')), field.slice(field.indexOf('.') + 1)]
    if (!catalog[report.from[as]]?.[name]?.personal) {
      reasons.push(`personal ${field}: no personal column the report reads`)
    }
  }
  return [...new Set(reasons)]
}

function filter(f: Filter, c: Column | null, reasons: string[]) {
  const ops = ['=', '<>', '<', '<=', '>', '>=', 'in', 'null', 'not null']
  if (!ops.includes(f.op)) {
    reasons.push(`filter ${f.field}: ${f.op} is no comparison (${ops.join(', ')})`)
    return
  }
  if (f.op === 'null' || f.op === 'not null') {
    if (f.value !== undefined) {
      reasons.push(`filter ${f.field} ${f.op} takes no value`)
    }
    return
  }
  if (!c) {
    return
  }
  const kind = kinds[c.type]
  if (kind === 'shown') {
    reasons.push(`filter ${f.field}: a ${c.type} is only shown, never compared`)
    return
  }
  if (kind === 'boolean' && !['=', '<>', 'in'].includes(f.op)) {
    reasons.push(`filter ${f.field}: a boolean is equal or not, never ${f.op}`)
  }
  const values = f.op === 'in' ? f.value : [f.value]
  if (!Array.isArray(values) || !values.length || values.length > MAX_IN) {
    reasons.push(`filter ${f.field} ${f.op}: ${f.op === 'in' ? `a list of 1 to ${MAX_IN} values` : 'one value'}`)
    return
  }
  for (const v of values) {
    if (!fits(v, kind, c.type)) {
      reasons.push(`filter ${f.field} ${f.op} ${JSON.stringify(v)}: not a ${c.type}`)
    }
  }
}

function fits(v: Value | Value[] | undefined, kind: Kind, type: Type): boolean {
  switch (kind) {
    case 'number':
      return typeof v === 'number' && Number.isFinite(v) && (type === 'numeric' || Number.isInteger(v))
    case 'text':
      return typeof v === 'string' && !v.includes('\0')
    case 'boolean':
      return typeof v === 'boolean'
    case 'date':
      return typeof v === 'string' && DATE.test(v) && !Number.isNaN(Date.parse(v))
    default:
      return false
  }
}

// A checked report as one statement over the shell's attach of the scope,
// `db`, and the rows it returns, as it fetches one past them to know there
// are more. Every name in it is the catalog's, quoted, and every value a
// literal of its column's type, checked first: the shell's protocol carries
// no bound parameters.
export function compile(report: Report, catalog: Catalog, db = 'scope'): { sql: string; limit: number } {
  const reasons = check(report, catalog)
  if (reasons.length) {
    throw new Invalid(reasons)
  }
  const typeOf = (field: string) => {
    const at = field.indexOf('.')
    return catalog[report.from[field.slice(0, at)]][field.slice(at + 1)].type
  }
  const ref = (field: string) => {
    const at = field.indexOf('.')
    return `${quote(field.slice(0, at))}.${quote(field.slice(at + 1))}`
  }
  const table = (view: string) => `${quote(db)}.${view.split('.').map(quote).join('.')}`
  const views = Object.entries(report.from)
  const joins = report.join ?? []
  const from = views
    .map(([as, view], i) => {
      if (i === 0) {
        return `${table(view)} AS ${quote(as)}`
      }
      const before = new Set(views.slice(0, i).map(([a]) => a))
      const on = joins
        .filter(([a, b]) => (a.startsWith(`${as}.`) && before.has(b.split('.')[0])) || (b.startsWith(`${as}.`) && before.has(a.split('.')[0])))
        .map(([a, b]) => `${ref(a)} = ${ref(b)}`)
      return `${report.outer?.includes(as) ? 'LEFT JOIN' : 'JOIN'} ${table(view)} AS ${quote(as)} ON ${on.join(' AND ')}`
    })
    .join(' ')
  const fields = report.fields ?? []
  const measures = Object.entries(report.measures ?? {})
  const select = [
    ...fields.map((f) => `${ref(f)} AS ${quote(f)}`),
    ...measures.map(([name, m]) => `${m.fn}(${m.of ? ref(m.of) : '*'}) AS ${quote(name)}`),
  ]
  const where = (report.where ?? []).map((f) => {
    if (f.op === 'null') {
      return `${ref(f.field)} IS NULL`
    }
    if (f.op === 'not null') {
      return `${ref(f.field)} IS NOT NULL`
    }
    if (f.op === 'in') {
      return `${ref(f.field)} IN (${(f.value as Value[]).map((v) => literal(v, typeOf(f.field))).join(', ')})`
    }
    return `${ref(f.field)} ${f.op} ${literal(f.value as Value, typeOf(f.field))}`
  })
  const limit = report.limit ?? MAX_ROWS
  const order = (report.order ?? []).map((o) => (o.startsWith('-') ? `${quote(o.slice(1))} DESC` : quote(o)))
  const sql = [
    `SELECT ${select.join(', ')}`,
    `FROM ${from}`,
    where.length ? `WHERE ${where.join(' AND ')}` : '',
    measures.length && fields.length ? `GROUP BY ${fields.map(ref).join(', ')}` : '',
    order.length ? `ORDER BY ${order.join(', ')}` : '',
    `LIMIT ${limit + 1}`,
  ]
    .filter(Boolean)
    .join(' ')
  return { sql, limit }
}

// A checked value as a literal of its column's type.
function literal(v: Value, type: Type): string {
  switch (kinds[type]) {
    case 'number':
      return String(v)
    case 'boolean':
      return v ? 'TRUE' : 'FALSE'
    case 'date':
      return `${type === 'date' ? 'DATE' : 'TIMESTAMPTZ'} ${text(String(v))}`
    default:
      return text(String(v))
  }
}

const text = (s: string) => `'${s.replaceAll("'", "''")}'`
