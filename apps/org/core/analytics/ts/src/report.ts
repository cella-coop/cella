// The analytics port: what a report asks of the analytics shell, what the
// shell offers it, and what a run returns. A page or a feat hands the port
// a report, never SQL; the shell's implementation checks it against the
// views the slices publish and runs it on one snapshot.

// A value a report reads, or a filter compares with: an amount in cents,
// a count or a whole number is a number, an exact decimal and a date are
// strings ('12.5', '2026-10-30').
export type Value = string | number | boolean | null

// The column types a contract shares, as Postgres names them.
export type Type =
  | 'bigint'
  | 'integer'
  | 'smallint'
  | 'numeric'
  | 'text'
  | 'boolean'
  | 'date'
  | 'timestamp with time zone'
  | 'jsonb'
  | 'text[]'

export interface Column {
  type: Type
  // Its contract comments it `personal: why`: it says who someone is.
  personal: boolean
}

// Whom a view's rows are for, as its contract's comment declares: a
// scoped view's rows are each a record's, `circle` its owning circle and
// `whose`, where a row is a person's, the column saying whose; a shared
// view's are sums and counts grouped `by` its columns and no finer; a
// contributions view's are each person's part of each cell of the shared
// view it counts, `of`, whose rows `feat`'s powers read, which only the
// port reads, to withhold a cell.
export type Audience =
  | { kind: 'scoped'; circle: string; whose: string | null }
  | { kind: 'shared'; by: string[] }
  | { kind: 'contributions'; of: string; feat: string }

export interface View {
  audience: Audience
  columns: Record<string, Column>
}

// What the analytics shell reads: each view the slices publish, by its
// qualified name ('project.projects').
export type Catalog = Record<string, View>

// What sums a measure, over the rows its report's fields group.
export interface Measure {
  fn: 'sum' | 'count' | 'min' | 'max' | 'avg'
  // A field; a count without one counts the rows.
  of?: string
}

export type Op = '=' | '<>' | '<' | '<=' | '>' | '>=' | 'in' | 'null' | 'not null'

export interface Filter {
  field: string
  op: Op
  // A value of the field's kind; a list for `in`; none for `null` and
  // `not null`.
  value?: Value | Value[]
}

// A report: the views it reads, each under a name of its own, the first
// the one the others join; a field is a view's name and a column,
// `p.title`.
export interface Report {
  from: Record<string, string>
  // How each view after the first meets one before it: pairs of fields
  // that are equal.
  join?: [string, string][]
  // The views after the first that may meet no row, their fields then
  // null: a project with no invoice still has a row.
  outer?: string[]
  // What each row shows, grouped by when the report has measures.
  fields?: string[]
  measures?: Record<string, Measure>
  where?: Filter[]
  // Fields shown or measures, `-` before one descending.
  order?: string[]
  // At most this many rows, and never more than `MAX_ROWS`.
  limit?: number
  // The personal fields the report reads, each declared: one shown,
  // joined, filtered, grouped or measured without it is refused.
  personal?: string[]
  // Whom it reads for, where it reads a scoped view: the server gives it
  // at each run, and a saved definition never names one.
  reader?: Reader
}

// The reader a report reads a scoped or a counted view for: the person,
// null where no one is signed in, and for each scoped view, by its
// qualified name, the owning circles whose rows their mandates open to
// them; and, for a counted view, the circles their powers over each
// feat's rows cover, by feat, and open books' disclosure values, null
// where no rule stands.
export interface Reader {
  person: string | null
  circles: Record<string, string[]>
  opens?: Record<string, string[]>
  disclosure?: Disclosure | null
}

// Open books' disclosure values: the fewest people a cell of a counted
// view counts, and the most of it, in percent, one and two of them put in.
export interface Disclosure {
  contributors: number
  largest: number
  two: number
}

// The log's head a run read: its every view as of that entry.
export interface Head {
  n: number
  hash: string | null
}

export interface Result {
  head: Head
  columns: { name: string; type: string }[]
  rows: Record<string, Value>[]
  // The report had more rows than it returned.
  more: boolean
  // How many cells of the counted views it read it left out.
  withheld: number
}

// The port a feat or a page calls; the shell's server implements it at
// assembly.
export interface Analytics {
  catalog(): Promise<Catalog>
  run(report: Report): Promise<Result>
}

export const MAX_ROWS = 10_000
