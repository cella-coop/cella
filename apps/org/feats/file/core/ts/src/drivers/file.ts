import type { Content, Db } from '@cella/org-db'
import type { File } from '../models/file.ts'

const columns = `f.id, f.class, f.subject, f.name, f.type, f.size, encode(f.hash, 'hex') AS hash, f.uploader,
  to_char(f.uploaded, 'YYYY-MM-DD') AS uploaded`

// Every file the co-op keeps, the latest first, without its bytes.
export async function files(db: Db): Promise<File[]> {
  const { rows } = await db.query<File>(`SELECT ${columns} FROM file.file f ORDER BY f.uploaded DESC, f.id DESC`)
  return rows
}

export async function file(db: Db, id: string): Promise<File | null> {
  const { rows } = await db.query<File>(`SELECT ${columns} FROM file.file f WHERE f.id = $1`, [id])
  return rows[0] ?? null
}

// A file's bytes, and whether `file.opens` opens them to the acting
// member; none once erased.
export async function content(db: Db, id: string, actor: string | null): Promise<Content | null> {
  const { rows } = await db.query<{ name: string; type: string; bytes: Uint8Array; open: boolean }>(
    'SELECT f.name, f.type, f.bytes, file.opens(f.id, $2) AS open FROM file.file f WHERE f.id = $1 AND f.bytes IS NOT NULL',
    [id, actor],
  )
  const r = rows[0]
  return r ? { name: r.name, type: r.type, bytes: new Uint8Array(r.bytes), open: r.open } : null
}
