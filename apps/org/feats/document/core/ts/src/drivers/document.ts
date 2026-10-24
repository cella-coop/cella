import type { Db } from '@cella/org-db'
import type { Listed, Note, Page, Update, Version } from '../models/document.ts'
import { draft } from '../handlers/loro.ts'

export async function documents(db: Db): Promise<Listed[]> {
  const { rows } = await db.query<Listed>(
    `SELECT d.id, d.title, (SELECT count(*)::int FROM document.version v WHERE v.document = d.id) AS versions,
            a.version AS adopted, (SELECT to_char(max(at), 'YYYY-MM-DD') FROM document.update u WHERE u.document = d.id) AS edited
     FROM document.document d LEFT JOIN document.adopted a ON a.document = d.id
     ORDER BY d.title`,
  )
  return rows
}

export async function document(db: Db, id: string): Promise<Page | null> {
  const found = await db.query<{ id: string; title: string; adopted: string | null }>(
    `SELECT d.id, d.title, a.version AS adopted FROM document.document d LEFT JOIN document.adopted a ON a.document = d.id WHERE d.id = $1`,
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
    `SELECT c.id::text AS id, c.version, c.author, to_char(c.at, 'YYYY-MM-DD') AS at, c.quote, c.text, c.resolved
     FROM document.comment c JOIN document.version v ON v.id = c.version WHERE v.document = $1 ORDER BY c.id DESC`,
    [id],
  )
  const updates = await db.query<Update>(
    `SELECT receipt::text AS id, receipt::int AS receipt, author, to_char(at, 'YYYY-MM-DD') AS at
     FROM document.update WHERE document = $1 ORDER BY receipt DESC`,
    [id],
  )
  return { ...d, draft: await draft(db, id), versions: versions.rows, comments: comments.rows, updates: updates.rows }
}
