import { MAX_ROWS, type Catalog, type Column, type Disclosure, type Filter, type Reader, type Report, type Type, type Value } from './report.ts'

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

// Every reason the catalog refuses a report, none when it may run; a
// `saved` definition, which whoever runs it reads for, names no reader.
export function check(report: Report, catalog: Catalog, saved = false): string[] {
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
    } else if (catalog[view].audience.kind === 'contributions') {
      reasons.push(`${view} is the contributions to ${(catalog[view].audience as { of: string }).of}, which only the port reads, to withhold a cell`)
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
    const columns = catalog[view]?.columns
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

  // Which rows it reads: a shared view by no field below its grain.
  for (const f of report.where ?? []) {
    filter(f, column(f.field, 'filter'), reasons)
    const at = f.field.indexOf('.')
    const audience = at > 0 && Object.hasOwn(report.from, f.field.slice(0, at)) ? catalog[report.from[f.field.slice(0, at)]]?.audience : undefined
    if (audience?.kind === 'shared' && !audience.by.includes(f.field.slice(at + 1))) {
      reasons.push(`filter ${f.field}: ${report.from[f.field.slice(0, at)]} is shared by ${audience.by.join(', ') || 'nothing'}, and no report filters it finer`)
    }
  }

  // Whom it reads for: a run of a scoped view, its reader and the circles
  // they read it in; a saved definition, no one.
  const reader = report.reader
  if (saved && reader !== undefined) {
    reasons.push('a saved report names no reader: whoever runs it reads it')
  }
  if (!saved && reader !== undefined && !(reader && (reader.person === null || typeof reader.person === 'string') && reader.circles && typeof reader.circles === 'object')) {
    reasons.push('a reader is a person, or null, and the circles they read each scoped view in')
  }
  for (const [as, view] of saved ? [] : views) {
    if (catalog[view]?.audience.kind !== 'scoped') {
      continue
    }
    const circles = reader?.circles?.[view]
    if (!reader) {
      reasons.push(`${as} (${view}) is scoped: a report reading it names its reader`)
    } else if (!Array.isArray(circles) || !circles.every((c) => typeof c === 'string')) {
      reasons.push(`${as} (${view}) is scoped: the reader's circles in it are not given`)
    }
  }
  // A counted view's run, its reader with the circles their powers over
  // its contributions' feat cover, and open books' disclosure values.
  for (const [as, view] of saved ? [] : views) {
    const by = counter(catalog, view)
    if (!by) {
      continue
    }
    const opens = reader?.opens?.[by.feat] ?? []
    if (!reader) {
      reasons.push(`${as} (${view}) is counted: a report reading it names its reader`)
    } else if (!reader.opens || typeof reader.opens !== 'object' || !Array.isArray(opens) || !opens.every((c) => typeof c === 'string')) {
      reasons.push(`${as} (${view}) is counted: the circles the reader's powers over ${by.feat} cover are not given`)
    } else if (reader.disclosure === undefined || (reader.disclosure !== null && !disclosure(reader.disclosure))) {
      reasons.push(`${as} (${view}) is counted: open books' disclosure values are not given, null where no rule stands`)
    }
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
    if (catalog[report.from[as]]?.columns[name]?.personal && !personal.has(field)) {
      reasons.push(`${field} is personal: a report reading it declares it in personal`)
    }
  }
  for (const field of personal) {
    const [as, name] = [field.slice(0, field.indexOf('.')), field.slice(field.indexOf('.') + 1)]
    if (!catalog[report.from[as]]?.columns[name]?.personal) {
      reasons.push(`personal ${field}: no personal column the report reads`)
    }
  }
  return [...new Set(reasons)]
}

// The contributions view that counts a shared view, and the feat whose
// powers read its rows; none for a view no contributions count.
export function counter(catalog: Catalog, view: string): { view: string; feat: string } | null {
  for (const [name, v] of Object.entries(catalog)) {
    if (v.audience.kind === 'contributions' && v.audience.of === view && catalog[view]?.audience.kind === 'shared') {
      return { view: name, feat: v.audience.feat }
    }
  }
  return null
}

// Whether disclosure values are sound: a whole number of people, and two
// shares in percent, the second no less than the first.
function disclosure(d: Disclosure): boolean {
  const share = (x: unknown) => typeof x === 'number' && Number.isFinite(x) && x >= 0 && x <= 100
  return typeof d === 'object' && Number.isInteger(d.contributors) && d.contributors >= 1 && share(d.largest) && share(d.two) && d.largest <= d.two
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
// are more, each scoped view kept to its reader's rows, in the join that
// meets it. Every name in it is the catalog's, quoted, and every value a
// literal of its column's type, checked first: the shell's protocol carries
// no bound parameters.
export function compile(report: Report, catalog: Catalog, db = 'scope'): { sql: string; limit: number; withheld: string | null } {
  const reasons = check(report, catalog)
  if (reasons.length) {
    throw new Invalid(reasons)
  }
  const typeOf = (field: string) => {
    const at = field.indexOf('.')
    return catalog[report.from[field.slice(0, at)]].columns[field.slice(at + 1)].type
  }
  const ref = (field: string) => {
    const at = field.indexOf('.')
    return `${quote(field.slice(0, at))}.${quote(field.slice(at + 1))}`
  }
  const table = (view: string) => `${quote(db)}.${view.split('.').map(quote).join('.')}`
  // The rows of a scoped view its reader reads: those of the circles they
  // read it in, and those that are theirs; none where neither is given.
  const kept = (as: string, view: string): string | null => {
    const audience = catalog[view].audience
    if (audience.kind !== 'scoped') {
      return null
    }
    const reader = report.reader as Reader
    const circles = reader.circles[view]
    const either = [
      circles.length ? `${quote(as)}.${quote(audience.circle)} IN (${circles.map(text).join(', ')})` : '',
      audience.whose && reader.person !== null ? `${quote(as)}.${quote(audience.whose)} = ${text(reader.person)}` : '',
    ].filter(Boolean)
    return either.length ? `(${either.join(' OR ')})` : 'FALSE'
  }
  const views = Object.entries(report.from)
  // The cells of a counted view its reader may not read: those whose every
  // contribution is neither theirs nor in a circle their powers over its
  // feat cover, and that open books does not share, by its contributions,
  // each person's part counted by its size. Where no rule stands, it
  // shares none.
  const withheld = (view: string): string | null => {
    const by = counter(catalog, view)
    if (!by) {
      return null
    }
    const keys = (catalog[view].audience as { by: string[] }).by.map(quote).join(', ')
    const reader = report.reader as Reader
    const opens = reader.opens?.[by.feat] ?? []
    const own = [
      reader.person !== null ? `"person" = ${text(reader.person)}` : '',
      opens.length ? `"circle" IN (${opens.map(text).join(', ')})` : '',
    ].filter(Boolean)
    const d = reader.disclosure
    const shared = d
      ? `(_c.n >= ${d.contributors} AND _c.total > 0 AND _c.largest * 100 <= ${d.largest} * _c.total AND (_c.largest + _c.second) * 100 <= ${d.two} * _c.total)`
      : 'FALSE'
    return [
      `SELECT ${keys} FROM (`,
      `SELECT ${keys}, count(*) AS n, sum(_p.a) AS total, max(_p.a) AS largest, coalesce(sum(_p.a) FILTER (WHERE _p.r = 2), 0) AS second, bool_and(_p.own) AS own`,
      `FROM (SELECT ${keys}, sum(abs("amount")) AS a, bool_and(coalesce(${own.length ? own.join(' OR ') : 'FALSE'}, FALSE)) AS own,`,
      `row_number() OVER (PARTITION BY ${keys} ORDER BY sum(abs("amount")) DESC, "person") AS r`,
      `FROM ${table(by.view)} GROUP BY ${keys}, "person") AS _p GROUP BY ${keys}) AS _c`,
      `WHERE NOT (_c.own OR ${shared})`,
    ].join(' ')
  }
  // A view as the report reads it: a counted one without the cells its
  // reader may not read, left out before the report joins, filters or
  // sums, so no total it shows is had less a withheld cell.
  const source = (view: string): string => {
    const cells = withheld(view)
    if (!cells) {
      return table(view)
    }
    const keys = (catalog[view].audience as { by: string[] }).by
    const meets = keys.map((k) => `_w.${quote(k)} IS NOT DISTINCT FROM _v.${quote(k)}`).join(' AND ')
    return `(SELECT _v.* FROM ${table(view)} AS _v WHERE NOT EXISTS (SELECT 1 FROM (${cells}) AS _w WHERE ${meets}))`
  }
  const joins = report.join ?? []
  const from = views
    .map(([as, view], i) => {
      if (i === 0) {
        return `${source(view)} AS ${quote(as)}`
      }
      const before = new Set(views.slice(0, i).map(([a]) => a))
      const on = joins
        .filter(([a, b]) => (a.startsWith(`${as}.`) && before.has(b.split('.')[0])) || (b.startsWith(`${as}.`) && before.has(a.split('.')[0])))
        .map(([a, b]) => `${ref(a)} = ${ref(b)}`)
        .concat(kept(as, view) ?? [])
      return `${report.outer?.includes(as) ? 'LEFT JOIN' : 'JOIN'} ${source(view)} AS ${quote(as)} ON ${on.join(' AND ')}`
    })
    .join(' ')
  const fields = report.fields ?? []
  const measures = Object.entries(report.measures ?? {})
  const select = [
    ...fields.map((f) => `${ref(f)} AS ${quote(f)}`),
    ...measures.map(([name, m]) => `${m.fn}(${m.of ? ref(m.of) : '*'}) AS ${quote(name)}`),
  ]
  const filters = (report.where ?? []).map((f) => {
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
  const first = kept(...views[0])
  const where = first ? [first, ...filters] : filters
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
  const counted = views.map(([, view]) => withheld(view)).filter((c): c is string => c !== null)
  return {
    sql,
    limit,
    withheld: counted.length ? `SELECT ${counted.map((c) => `(SELECT count(*) FROM (${c}) AS _w)`).join(' + ')} AS n` : null,
  }
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
