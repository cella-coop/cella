import pg from 'pg'
import { DATABASE_URL } from '$app/env/private'
import { lending } from '@cella/org-db'

// The app's connections, as the app role: it reads the feats' schemas and
// submits writes; it never writes the log itself. A request borrows a
// connection for each read and each write's transaction, and holds none
// while a write waits on its signer (`lent` in `@cella/org-db`). Whatever
// role the URL logs in as, such as the owner `cella serve --prod`
// migrates with, every borrow acts as `cella_app`, so the row-level
// policies hold: an owner or a superuser would read past them. Each
// pool names its connections, as `pg_stat_activity` shows them.
//
// An idle connection the server ends, as a restart or a dropped database
// ends every one, is reported on its pool, which discards it and opens a
// fresh one at the next borrow; unheard, the report would end the process.
const connections = (max: number, application_name: string) => {
  const p = new pg.Pool({ connectionString: DATABASE_URL, user: DATABASE_URL ? undefined : 'cella_app', max, application_name })
  p.on('error', (e) => console.warn(`${application_name}: an idle connection ended: ${e.message}`))
  return p
}

// Eight connections: six for pages and writes, and two kept for reading
// sessions, which nothing else takes, so pages and writes holding all six
// keep no one from signing in and no proof from reaching its run.
const pool = connections(6, 'cella')
const sessions = connections(2, 'cella sessions')

// One connection, in a transaction of its own, as `cella_app`, reading for
// `actor`, the signed-in person, or for no one: both set for the
// transaction alone before any query, so every row-level policy reads as
// them, and cleared as it ends, so it goes back reading as no one.
export const using = lending(pool, 'cella_app')

// One of the two connections kept for reading sessions, lent as `using`
// lends: for the session read every request makes first, and the
// sign-in's challenge and answer, and for nothing else.
export const reading = lending(sessions, 'cella_app')
