// The port over the analytics shell: a DuckDB client that attaches the
// shell's server over quack and runs each report in it, on one snapshot
// of the scope stamped with the log's head. The org app's server makes it
// at assembly; a feat calls the port it is handed, never this.

import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { DuckDBInstance, type DuckDBConnection } from '@duckdb/node-api'
import { compile } from '../check.ts'
import type { Analytics, Catalog, Head, Result, Type, Value } from '../report.ts'

export interface Options {
  // Where the shell serves, `quack:localhost:54343`.
  url: string
  token: string
  // The directory holding DuckDB's extensions by version and platform,
  // the flake's `CELLA_DUCKDB_EXTENSIONS`.
  extensions: string
}

// The shell as `cella` hands it to a server: `CELLA_ANALYTICS`, the
// owner-only `CELLA_ANALYTICS_TOKEN_FILE` and `CELLA_DUCKDB_EXTENSIONS`;
// null when any is unset.
export function fromEnv(env: Record<string, string | undefined> = process.env): Options | null {
  const { CELLA_ANALYTICS: url, CELLA_ANALYTICS_TOKEN_FILE: file, CELLA_DUCKDB_EXTENSIONS: extensions } = env
  if (!url || !file || !extensions) {
    return null
  }
  return { url, token: readFileSync(file, 'utf8').trim(), extensions }
}

// The views the role reads and their columns, from the scope's catalog as
// the role sees it: a view it may not read is no view of the catalog. The
// notary's head, which stamps each run, is no view a report reads.
const CATALOG = `
  SELECT n.nspname || '.' || c.relname AS view, a.attname AS name, format_type(a.atttypid, NULL) AS type,
         coalesce(col_description(c.oid, a.attnum) ~ '^personal:', false) AS personal
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
  WHERE c.relkind = 'v' AND n.nspname NOT IN ('pg_catalog', 'information_schema', 'analytics')
    AND has_schema_privilege(n.oid, 'USAGE') AND has_table_privilege(c.oid, 'SELECT')
  ORDER BY 1, a.attnum`

const quote = (s: string) => `'${s.replaceAll("'", "''")}'`

// What each run of a DuckDB integer type reads as: a number while it is
// one exactly, else its digits.
const WHOLE = new Set(['TINYINT', 'SMALLINT', 'INTEGER', 'BIGINT', 'HUGEINT', 'UTINYINT', 'USMALLINT', 'UINTEGER', 'UBIGINT', 'UHUGEINT'])

export async function shell(options: Options): Promise<Analytics & { close: () => void }> {
  const instance = await DuckDBInstance.create(':memory:')
  const setup = await instance.connect()
  const [{ v, p }] = (await setup.runAndReadAll('SELECT version() AS v, (SELECT platform FROM pragma_platform()) AS p')).getRowObjectsJson() as {
    v: string
    p: string
  }[]
  for (const ext of ['httpfs', 'quack']) {
    await setup.run(`LOAD ${quote(join(options.extensions, v, p, `${ext}.duckdb_extension`))}`)
  }
  setup.closeSync()

  // One session of the shell per run, routed to it, in one transaction:
  // the shell's attach reads the scope on one Postgres snapshot through
  // it. The shell keeps a session per client, and every connection of a
  // process is one client but for its id, so each run attaches the shell
  // under an id of its own.
  let runs = 0
  const session = async <T>(work: (c: DuckDBConnection) => Promise<T>): Promise<T> => {
    const c = await instance.connect()
    const name = `run_${++runs}`
    await c.run(`ATTACH ${quote(options.url)} AS ${name} (TYPE quack, TOKEN ${quote(options.token)}, CLIENT_ID ${quote(randomUUID())})`)
    try {
      await c.run(`CONNECT ${name}`)
      await c.run('BEGIN TRANSACTION')
      try {
        const out = await work(c)
        await c.run('COMMIT')
        return out
      } catch (e) {
        await c.run('ROLLBACK').catch(() => {})
        throw e
      }
    } finally {
      await c.run('DISCONNECT').catch(() => {})
      await c.run(`DETACH ${name}`).catch(() => {})
      c.closeSync()
    }
  }
  const catalogOf = async (c: DuckDBConnection): Promise<Catalog> => {
    const rows = (await c.runAndReadAll(`SELECT * FROM postgres_query('scope', ${quote(CATALOG)})`)).getRowObjectsJson() as {
      view: string
      name: string
      type: Type
      personal: boolean
    }[]
    const catalog: Catalog = {}
    for (const r of rows) {
      catalog[r.view] ??= {}
      catalog[r.view][r.name] = { type: r.type, personal: r.personal }
    }
    return catalog
  }

  return {
    catalog: () => session(catalogOf),
    run: (report) =>
      session(async (c): Promise<Result> => {
        const [h] = (await c.runAndReadAll('SELECT n, hash FROM scope.analytics.head')).getRowObjectsJson() as { n: string; hash: string }[]
        const head: Head = h ? { n: Number(h.n), hash: h.hash } : { n: 0, hash: null }
        const { sql, limit } = compile(report, await catalogOf(c))
        const read = await c.runAndReadAll(sql)
        const columns = read.columnNames().map((name, i) => ({ name, type: read.columnTypes()[i].toString() }))
        const rows = (read.getRowObjectsJson() as Record<string, Value>[]).map((row) => {
          for (const { name, type } of columns) {
            const x = row[name]
            if (WHOLE.has(type) && typeof x === 'string' && Number.isSafeInteger(Number(x))) {
              row[name] = Number(x)
            }
          }
          return row
        })
        return { head, columns, rows: rows.slice(0, limit), more: rows.length > limit }
      }),
    close: () => instance.closeSync(),
  }
}
