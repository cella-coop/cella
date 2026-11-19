import { command, form, query } from '$app/server'
import { collection as call, index as indexed, within as scoped } from '#lib/server/calls.ts'
import { action } from '#lib/server/slices.ts'
import { failed } from '#lib/server/write.ts'
import { item } from './item.remote.ts'
import { sent } from './sent.ts'
import { served } from './serve.ts'
import { answer, keyed, pairs, posted, written } from './write.ts'

// A collection's rows a page at a time, with its counts, its values and
// its about, as the `[collection]` page reads them.
export const collection = query(call.schema, (arg) => served((db, who) => call.run(db, arg, who)))

// A collection scoped to a record, as the record's tab lists it.
export const within = query(scoped.schema, (arg) => served((db, who) => scoped.run(db, arg, who)))

// What the command menu searches: every item each collection indexes.
export const index = query(() => served((db) => indexed.run(db)))

// What a write on a collection's page or an item's may change, read again
// in its answer where the page reads it.
const touched = () => [collection, within, item, index]

// A write on a collection's page or an item's, by the write its
// collection's slices name, keyed by the collection, the item and the
// write (`write.for(key)`): its fields as the form posts them.
export const write = form('unchecked', async (data: Record<string, unknown>) => {
  const key = keyed(data.id, ['collection'], ['id'])
  if (typeof key === 'string') {
    return failed(400, key)
  }
  const { collection: name, id } = key.at
  return answer(await written(action(name!, key.write), key.write, posted(data), id), touched())
})

// The same write posted without a form, by a page's script: a dropped
// card's move, an agenda's, a document's edit.
export const send = command(sent, async ({ at, write: name, fields }) => {
  const key = keyed({ at, write: name }, ['collection'], ['id'])
  if (typeof key === 'string') {
    return failed(400, key)
  }
  return answer(await written(action(key.at.collection!, name), name, pairs(fields), key.at.id), touched())
})
