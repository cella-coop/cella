import type { Db } from './index.ts'
import { texts } from './schema.ts'

// A query a slice writes in SQL: a view in its own schema that reads as
// its reader, which it declares among its calls (architecture.md,
// "Queries in SQL"). `by` names the columns its argument holds, each a
// text matched by equality; `columns` those of its rows; `order` those
// they are ordered by, which may be the view's and not the rows'. `R` is
// its rows' type, which `ask` returns and no value carries.
export interface Query<R extends object = object> {
  view: string
  by: readonly string[]
  columns: readonly string[]
  order: readonly string[]
  readonly rows?: R[]
}

// An argument a query's schema refuses: a transport answers it as a 400.
export class Unfit extends Error {}

const plain = /^[a-z_][a-z0-9_]*$/

// What is wrong with a query's names, if anything: its view is a plain
// name in `schema`, the slice's own, and every column a plain name, so
// `ask` may name them in its statement.
export function malformed(q: Query, schema: string): string | null {
  const [owner, view, ...rest] = q.view.split('.')
  if (owner !== schema || !view || rest.length || !plain.test(view)) {
    return `its view ${q.view} is not a view of its own schema, ${schema}`
  }
  const bad = [...q.by, ...q.columns, ...q.order].find((c) => !plain.test(c))
  return bad === undefined ? null : `${bad} is not a plain column name`
}

// The query's rows for `arg`, validated by its schema, the texts `by`
// names, read on `db` as its reader.
export async function ask<R extends object>(db: Db, q: Query<R>, arg: unknown): Promise<R[]> {
  const checked = texts(q.by)['~standard'].validate(arg)
  if ('issues' in checked) {
    throw new Unfit(checked.issues.map((i) => i.message).join('; '))
  }
  const where = q.by.map((c, i) => `${c} = $${i + 1}`)
  const { rows } = await db.query<R>(
    `SELECT ${q.columns.join(', ')} FROM ${q.view}${where.length ? ` WHERE ${where.join(' AND ')}` : ''}${q.order.length ? ` ORDER BY ${q.order.join(', ')}` : ''}`,
    q.by.map((c) => checked.value[c]),
  )
  return rows
}
