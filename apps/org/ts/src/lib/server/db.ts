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
const connections = (max: number, application_name: string) =>
  new pg.Pool({ connectionString: DATABASE_URL, user: DATABASE_URL ? undefined : 'cella_app', max, application_name })

// Eight connections: six for pages and writes, and two kept for reading
// sessions, which nothing else takes, so pages and writes holding all six
// keep no one from signing in and no proof from reaching its run. Left
// at six, not raised: a visitor copy's own Postgres role has a
// `CONNECTION LIMIT` of its own (`--connections`, `tools/demo-serve.mjs`,
// defaulting to 10, never grepped higher here since production's own
// flag is not this repo's to assume), tighter than Postgres's
// `max_connections` across every copy; eight already fits it with room
// to spare, and raising it to ten exactly reached that limit and the
// front logged "too many connections for role" under this file's own
// load. A record's several reads now borrow this same pool for each
// at once (`#lib/remote/serve.ts`'s `borrow`) instead of queuing on one
// connection, which is where the room for four browsers was needed.
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
