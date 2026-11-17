import { query } from '$app/server'
import { readers as call } from '#lib/server/calls.ts'
import { served } from './serve.ts'

// Whom a mention of a record may name, as the comment box's mention
// picker reads it once it mounts: never awaited at SSR with the item.
export const readers = query(call.schema, (arg) => served((db, who) => call.run(db, arg, who)))
