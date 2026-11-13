import { error } from '@sveltejs/kit'
import { getRequestEvent } from '$app/server'
import { Missing, type Reader } from '#lib/server/calls.ts'
import { using } from '#lib/server/db.ts'
import { Unfit, type Db } from '@cella/org-db'

// Runs a call as the session's person, on a connection of its own, as
// every read does; what is missing is a 404, as on a page, and an
// argument a query's schema refuses a 400.
export async function served<T>(call: (db: Db, who: Reader) => Promise<T>): Promise<T> {
  const { locals, cookies } = getRequestEvent()
  try {
    return await using(locals.actor, (db) => call(db, { actor: locals.actor, session: locals.session, cookies }))
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
