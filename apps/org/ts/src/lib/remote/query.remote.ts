import { query } from '$app/server'
import { ask as call } from '#lib/server/calls.ts'
import { served } from './serve.ts'

// A query a slice writes in SQL, as any page or block may read it.
export const ask = query(call.schema, (arg) => served((db) => call.run(db, arg)))
