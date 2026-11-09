import type { Db } from './index.ts'
import { texts } from './schema.ts'

// A query a slice writes in SQL: a view in its own schema that reads as
// its reader, which it declares among its calls (architecture.md,
// "Queries in SQL"). `by` names the columns its argument holds, each a
// text matched by equality; `columns` those of its rows; `order` those
// they are ordered by, which may be the view's and not the rows'. `R` is
// its rows' type, which `ask` returns and no value carries. A query
// `published` is a view of its slice's analytical contract, which reads
// as its owner and is read only through the analytics port; `personal`
// names the columns its contract comments personal (architecture.md,
// "Analytical contracts").
export interface Query<R extends object = object> {
  view: string
  published?: true
  by: readonly string[]
  columns: readonly string[]
  personal?: readonly string[]
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
  const bad = [...q.by, ...q.columns, ...(q.personal ?? []), ...q.order].find((c) => !plain.test(c))
  return bad === undefined ? null : `${bad} is not a plain column name`
}

// The query's argument, validated by its schema, the texts `by` names.
export function argued(q: Query, arg: unknown): Record<string, string> {
  const checked = texts(q.by)['~standard'].validate(arg)
  if ('issues' in checked) {
    throw new Unfit(checked.issues.map((i) => i.message).join('; '))
  }
  return checked.value as Record<string, string>
}

// The query's rows for `arg`, validated by its schema, read on `db` as
// its reader. A published query reads as its owner, so it is never read
// on a reader's connection: the port reads it for them.
export async function ask<R extends object>(db: Db, q: Query<R>, arg: unknown): Promise<R[]> {
  if (q.published) {
    throw new Error(`${q.view} is published in its slice's analytical contract and reads as its owner: it is read through the analytics port`)
  }
  const value = argued(q, arg)
  const where = q.by.map((c, i) => `${c} = $${i + 1}`)
  const { rows } = await db.query<R>(
    `SELECT ${q.columns.join(', ')} FROM ${q.view}${where.length ? ` WHERE ${where.join(' AND ')}` : ''}${q.order.length ? ` ORDER BY ${q.order.join(', ')}` : ''}`,
    q.by.map((c) => value[c]),
  )
  return rows
}
