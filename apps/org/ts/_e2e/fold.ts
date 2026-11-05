// The fold, as the scenarios run it: `cella fold` of a database's log
// into a fresh one beside it, and the rows of every state table of each,
// as the state hash reads them, to compare the two whole where a scenario
// writes only slices that fold (architecture.md, "Folds").
import pg from 'pg'
import { cella } from './cluster.ts'

// Folds `db`'s log into `<db>_fold` and compares the folded slices; what
// `cella fold` printed.
export function folded(db: string): string {
  return cella(['fold', db, '--into', `${db}_fold`, '--compare'])
}

// Each state table of `db` with a digest of its rows, by the table's
// name, the folded slices' and the others' alike.
export async function tables(db: string): Promise<Record<string, string>> {
  const c = new pg.Client({ database: db })
  await c.connect()
  try {
    const { rows } = await c.query<{ tab: string; rows: string }>(
      `SELECT tab, md5(string_agg(r, E'\\n' ORDER BY r COLLATE "C")) AS rows
       FROM cella.state_rows(ARRAY(SELECT DISTINCT schema FROM cella.state)) GROUP BY tab`,
    )
    return Object.fromEntries(rows.map((r) => [r.tab, r.rows]))
  } finally {
    await c.end()
  }
}

// Drops the database `folded` made.
export async function unfold(db: string): Promise<void> {
  const c = new pg.Client()
  await c.connect()
  await c.query(`DROP DATABASE IF EXISTS ${c.escapeIdentifier(`${db}_fold`)} WITH (FORCE)`)
  await c.end()
}
