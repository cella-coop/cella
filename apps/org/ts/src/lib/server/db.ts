import pg from 'pg'
import { DATABASE_URL } from '$app/env/private'
import { lending } from '@cella/org-db'

// The app's connections, as the app role: it reads the feats' schemas and
// submits writes; it never writes the log itself. A request borrows a
// connection for each read and each write's transaction, and holds none
// while a write waits on its signer (`lent` in `@cella/org-db`). Whatever
// role the URL logs in as, such as the owner `cella serve --prod`
// migrates with, every borrow acts as `cella_app`, so the row-level
// policies hold: an owner or a superuser would read past them.
const pool = new pg.Pool({ connectionString: DATABASE_URL, user: DATABASE_URL ? undefined : 'cella_app', max: 8 })

// One connection, in a transaction of its own, as `cella_app`, reading for
// `actor`, the signed-in person, or for no one: both set for the
// transaction alone before any query, so every row-level policy reads as
// them, and cleared as it ends, so it goes back reading as no one.
export const using = lending(pool, 'cella_app')
