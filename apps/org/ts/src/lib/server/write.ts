import { error, fail, type RequestEvent } from '@sveltejs/kit'
import type { Done, Form, Upload } from '@cella/org-db'
import { using } from './db.ts'
import { deps } from './device.ts'
import { action, reactions } from './slices.ts'

// A form's fields as text, and the files it carries read whole; a file
// input left empty carries no file.
export async function fields(data: FormData): Promise<Form> {
  const files = new Map<string, Upload>()
  for (const [name, value] of data) {
    if (value instanceof File && value.size > 0) {
      files.set(name, { name: value.name, type: value.type || 'application/octet-stream', bytes: new Uint8Array(await value.arrayBuffer()) })
    }
  }
  return {
    get: (name) => {
      const v = data.get(name)
      return typeof v === 'string' ? v : ''
    },
    all: (name) => data.getAll(name).flatMap((v) => (typeof v === 'string' ? [v] : [])),
    file: (name) => files.get(name) ?? null,
  }
}

// Why a write failed, as the page may say it: what a form reader or a
// handler threw about its input, a plain Error, or a value Postgres could
// not take (SQLSTATE class 22). Anything else, a bug or the database's
// internals, is logged here and said generically.
function reason(e: unknown): string {
  const code = (e as { code?: unknown }).code
  if (e instanceof Error && (typeof code === 'string' ? code.startsWith('22') : e.constructor === Error)) {
    return e.message
  }
  console.error(e)
  return 'the server could not take this write; its output says why'
}

// One write from a page: the action the collection's slices name, run as
// the acting member's device, then the reactions to it if it settled. A
// refusal or a failure is a 4xx, so the form keeps what was typed.
export async function perform(event: RequestEvent, collection: string, name: string, id?: string) {
  const write = action(collection, name)
  if (!write) {
    error(404, `${collection} has no write ${name}`)
  }
  const form = await fields(await event.request.formData())
  return using(async (db) => {
    const signing = await deps(db, event.locals.actor)
    if (typeof signing === 'string') {
      return fail(403, { done: { op: write.op, state: 'failed', reason: signing, then: [] } satisfies Done })
    }
    let result: Awaited<ReturnType<typeof write.run>>
    try {
      result = await write.run(form, signing, id)
    } catch (e) {
      return fail(400, { done: { op: write.op, state: 'failed', reason: reason(e), then: [] } satisfies Done })
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
