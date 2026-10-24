import { error, fail, type RequestEvent } from '@sveltejs/kit'
import type { Done, Form } from '@cella/org-db'
import { using } from './db.ts'
import { deps } from './device.ts'
import { action, reactions } from './slices.ts'

const fields = (data: FormData): Form => ({
  get: (name) => String(data.get(name) ?? ''),
  all: (name) => data.getAll(name).map(String),
})

// One write from a page: the action the collection's slices name, run as
// the acting member's device, then the reactions to it if it settled. A
// refusal or a failure is a 4xx, so the form keeps what was typed.
export async function perform(event: RequestEvent, collection: string, name: string, id?: string) {
  const write = action(collection, name)
  if (!write) {
    error(404, `${collection} has no write ${name}`)
  }
  const form = fields(await event.request.formData())
  return using(async (db) => {
    const signing = await deps(db, event.locals.actor)
    if (typeof signing === 'string') {
      return fail(403, { done: { op: write.op, state: 'failed', reason: signing, then: [] } satisfies Done })
    }
    let result: Awaited<ReturnType<typeof write.run>>
    try {
      result = await write.run(form, signing, id)
    } catch (e) {
      return fail(400, { done: { op: write.op, state: 'failed', reason: (e as Error).message, then: [] } satisfies Done })
    }
    const { done, request } = result
    if (done.state === 'settled') {
      for (const react of reactions(write.op)) {
        done.then.push(...(await react(request, signing)))
      }
    }
    return done.state === 'refused' ? fail(422, { done }) : { done }
  })
}
