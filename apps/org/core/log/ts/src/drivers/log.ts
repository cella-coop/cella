import type { Db, Read } from '@cella/org-db'
import type { Detail, Entry, Head } from '../models/log.ts'

const entry = `l.n::text AS id, l.n::int AS n, l.op, l.actor, to_char(l.date, 'YYYY-MM-DD') AS date, l.guards,
  l.receipt::int AS receipt, r.at, encode(r.device, 'hex') AS device, cella.records(l.n) AS records`

// The scope every write signature names, as the database is set.
export async function scope(db: Db): Promise<string | null> {
  const { rows } = await db.query<{ scope: string | null }>(`SELECT nullif(current_setting('cella.scope', true), '') AS scope`)
  return rows[0].scope
}

// The scope as a person reads it: its address, and the co-op's name and
// legal name, which `cella seed` sets on the database beside the address
// (`cella.scope_name`, `cella.scope_legal_name`); the address stands in
// for a name not set.
export async function named(db: Db): Promise<{ address: string | null; name: string | null; legal: string | null }> {
  const { rows } = await db.query<{ address: string | null; name: string | null; legal: string | null }>(
    `SELECT nullif(current_setting('cella.scope', true), '') AS address,
            nullif(current_setting('cella.scope_name', true), '') AS name,
            nullif(current_setting('cella.scope_legal_name', true), '') AS legal`,
  )
  return rows[0]
}

// The entries as the collection lists them, newest first.
export const listing: Read = {
  sql: `SELECT ${entry} FROM cella.log l JOIN cella.receipt r ON r.n = l.receipt`,
  order: 'n DESC',
}

// Every entry, newest first.
export async function entries(db: Db): Promise<Entry[]> {
  const { rows } = await db.query<Entry>(`SELECT ${entry} FROM cella.log l JOIN cella.receipt r ON r.n = l.receipt ORDER BY l.n DESC`)
  return rows
}

export async function detail(db: Db, n: string): Promise<Detail | null> {
  if (!/^\d+$/.test(n)) {
    return null
  }
  const { rows } = await db.query<Omit<Detail, 'texts'>>(
    `SELECT ${entry}, encode(l.payload, 'hex') AS payload, encode(l.prev, 'hex') AS prev, encode(l.hash, 'hex') AS hash,
            encode(l.sig, 'hex') AS sig, r.nonce, encode(r.request, 'hex') AS request, encode(r.signature, 'hex') AS signature
     FROM cella.log l JOIN cella.receipt r ON r.n = l.receipt WHERE l.n = $1`,
    [n],
  )
  const found = rows[0]
  if (!found) {
    return null
  }
  const texts = await db.query<{ hash: string; body: string }>(
    `SELECT encode(hash, 'hex') AS hash, body FROM cella.guard_text WHERE encode(hash, 'hex') = ANY($1)`,
    [found.guards.map((r) => r.text)],
  )
  const bodies = new Map(texts.rows.map((t) => [t.hash, t.body]))
  return { ...found, texts: found.guards.map((r) => ({ ...r, body: bodies.get(r.text) ?? null })) }
}

// Whether the whole log verifies, its head and the scope's key.
export async function head(db: Db): Promise<Head> {
  const { rows } = await db.query<Head>(
    `SELECT cella.verify_log() AS verified, (SELECT n FROM cella.head)::int AS n, encode(cella.notary_key(), 'hex') AS key,
            nullif(current_setting('cella.scope', true), '') AS scope`,
  )
  return rows[0]
}
