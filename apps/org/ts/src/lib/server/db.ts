import pg from 'pg'
import { DATABASE_URL } from '$app/env/private'
import type { Db } from '@cella/org-db'

// The app's connections, as the app role: it reads the feats' schemas and
// submits writes; it never writes the log itself. A request borrows a
// connection for each read and each write's transaction, and holds none
// while a write waits on its signer (`lent` in `@cella/org-db`). Whatever
// role the URL logs in as, such as the owner `cella serve --prod`
// migrates with, every connection acts as `cella_app`, so the row-level
// policies hold: an owner or a superuser would read past them.
const pool = new pg.Pool({ connectionString: DATABASE_URL, user: DATABASE_URL ? undefined : 'cella_app', max: 8 })

const reads = `SELECT set_config('role', 'cella_app', false), set_config('cella.actor', $1, false)`

// One connection, as `cella_app`, reading for `actor`, the signed-in
// person, or for no one: `cella.actor` is set on it from the session
// before any query, so every row-level policy reads as them, and cleared
// before it goes back; one that cannot be cleared is closed.
export async function using<T>(actor: string | null, fn: (db: Db) => Promise<T>): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query(reads, [actor ?? ''])
    return await fn(client)
  } finally {
    await client.query(reads, ['']).then(
      () => client.release(),
      (e: Error) => client.release(e),
    )
  }
}
