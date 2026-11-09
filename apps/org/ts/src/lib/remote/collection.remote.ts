import { query } from '$app/server'
import { collection as call, index as indexed } from '#lib/server/calls.ts'
import { served } from './serve.ts'

// A collection's rows a page at a time, with its counts, its values and
// its about, as the `[collection]` page reads them.
export const collection = query(call.schema, (arg) => served((db, who) => call.run(db, arg, who)))

// What the command menu searches: every item each collection indexes.
export const index = query(() => served((db) => indexed.run(db)))
