import type { Db, Read } from '@cella/org-db'
import { b64, type Listed, type Note, type Page, type Shown, type Update, type Version } from '../models/document.ts'
import type { Canon } from '../models/canonical.ts'
import { merged } from '../handlers/loro.ts'
import { canonical, hash } from '../models/canonical.ts'

const listed = (adopted: string) => `SELECT d.id, d.title, d.circle, (SELECT count(*)::int FROM document.version v WHERE v.document = d.id) AS versions,
  ${adopted} AS adopted, (SELECT to_char(max(at), 'YYYY-MM-DD') FROM document.update u WHERE u.document = d.id) AS edited
  FROM document.document d LEFT JOIN document.adopted a ON a.document = d.id`

// The documents as the collection lists them, by title, each with the
// version adopted, or "not adopted", as its badge shows it.
export const listing: Read = {
  sql: listed(`coalesce(a.version, 'not adopted')`),
  order: 'title',
}

export async function documents(db: Db): Promise<Listed[]> {
  const { rows } = await db.query<Listed>(`${listed('a.version')} ORDER BY d.title`)
  return rows
}

export async function document(db: Db, id: string): Promise<Page | null> {
  const found = await db.query<{ id: string; title: string; adopted: string | null; generated: string | null }>(
    `SELECT d.id, d.title, a.version AS adopted, g.circle AS generated
     FROM document.document d LEFT JOIN document.adopted a ON a.document = d.id
     LEFT JOIN document.generated g ON g.document = d.id WHERE d.id = $1`,
    [id],
  )
  const d = found.rows[0]
  if (!d) {
    return null
  }
  const versions = await db.query<Version>(
    `SELECT v.id, v.n, to_char(v.saved, 'YYYY-MM-DD') AS saved, encode(v.hash, 'hex') AS hash, v.id = $2 AS adopted
     FROM document.version v WHERE v.document = $1 ORDER BY v.n DESC`,
    [id, d.adopted],
  )
  const comments = await db.query<Note>(
    `SELECT c.id::text AS id, c.version, c.author, to_char(c.at, 'YYYY-MM-DD') AS at, c.quote, c.text, c.resolved, c.anchor
     FROM document.comment c JOIN document.version v ON v.id = c.version WHERE v.document = $1 ORDER BY c.id DESC`,
    [id],
  )
  const updates = await db.query<Update>(
    `SELECT receipt::text AS id, receipt::int AS receipt, author, to_char(at, 'YYYY-MM-DD') AS at
     FROM document.update WHERE document = $1 ORDER BY receipt DESC, n DESC`,
    [id],
  )
  const doc = await merged(db, id)
  return {
    id: d.id,
    title: d.title,
    adopted: d.adopted,
    generated: d.generated,
    snapshot: b64.encode(doc.export({ mode: 'snapshot' })),
    draft: canonical(doc),
    hash: hash(doc),
    versions: versions.rows,
    comments: comments.rows,
    updates: updates.rows,
  }
}

// A version as the database canonicalised and hashed it.
export async function shown(db: Db, version: string): Promise<Shown | null> {
  const { rows } = await db.query<{ id: string; document: string; hash: string; canonical: string }>(
    `SELECT id, document, encode(hash, 'hex') AS hash, canonical FROM document.version WHERE id = $1`,
    [version],
  )
  const v = rows[0]
  return v ? { id: v.id, document: v.document, hash: v.hash, canonical: JSON.parse(v.canonical) as Canon } : null
}
