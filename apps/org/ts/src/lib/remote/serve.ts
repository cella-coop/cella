import { error } from '@sveltejs/kit'
import { getRequestEvent } from '$app/server'
import { Missing, type Reader } from '#lib/server/calls.ts'
import { using } from '#lib/server/db.ts'
import { Unfit, type Borrow, type Db } from '@cella/org-db'

// Runs a call as the session's person, on a connection of its own, as
// every read does; what is missing is a 404, as on a page, and an
// argument a query's schema refuses a 400. A call that reads more than
// one thing at once, as a record's page does, may borrow a further
// connection of its own for each, rather than queue them one after
// another on this one; most calls take only `db` and leave `borrow`
// unused.
export async function served<T>(call: (db: Db, who: Reader, borrow: Borrow) => Promise<T>): Promise<T> {
  const { locals, cookies } = getRequestEvent()
  const borrow: Borrow = (fn) => using(locals.actor, fn)
  try {
    return await using(locals.actor, (db) => call(db, { actor: locals.actor, session: locals.session, cookies }, borrow))
  } catch (e) {
    if (e instanceof Missing) {
      error(404, e.message)
    }
    if (e instanceof Unfit) {
      error(400, e.message)
    }
    throw e
  }
}
