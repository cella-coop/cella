import pg from 'pg'
import { DATABASE_URL } from '$app/env/private'
import type { Db } from '@cella/org-db'

// The app's connections, as the app role: it reads the feats' schemas and
// submits writes; it never writes the log itself. Each request holds one
// connection, which a write's transaction needs.
const pool = new pg.Pool({ connectionString: DATABASE_URL, user: DATABASE_URL ? undefined : 'cella_app', max: 8 })

export async function using<T>(fn: (db: Db) => Promise<T>): Promise<T> {
  const client = await pool.connect()
  try {
    return await fn(client)
  } finally {
    client.release()
  }
}
