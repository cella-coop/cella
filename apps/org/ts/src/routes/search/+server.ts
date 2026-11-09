import { index } from '#lib/server/calls.ts'
import { using } from '#lib/server/db.ts'
import type { RequestHandler } from './$types'

// Every item the command menu can jump to, from each collection's index,
// as JSON: the call the `index` query serves.
export const GET: RequestHandler = async ({ locals }) => Response.json(await using(locals.actor, (db) => index.run(db)))
