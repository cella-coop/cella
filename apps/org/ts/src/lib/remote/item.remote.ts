import { query } from '$app/server'
import { item as call } from '#lib/server/calls.ts'
import { served } from './serve.ts'

// An item with each extension's data on it, as the `[collection]/[id]`
// page reads it.
export const item = query(call.schema, (arg) => served((db, who) => call.run(db, arg, who)))
