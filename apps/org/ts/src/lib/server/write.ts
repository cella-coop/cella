import { error, fail, type RequestEvent } from '@sveltejs/kit'
import { lent, type Done, type Form, type Upload } from '@cella/org-db'
import { scope } from '@cella/org-log/api'
import { using } from './db.ts'
import { answered, proof, relay, type Ask } from './relay.ts'
import { action, reacting } from './slices.ts'

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
export function reason(e: unknown): string {
  const code = (e as { code?: unknown }).code
  if (e instanceof Error && (typeof code === 'string' ? code.startsWith('22') : e.constructor === Error)) {
    return e.message
  }
  console.error(e)
  return 'the server could not take this write; its output says why'
}

// One write from a page: the action the collection's slices name, run as
// the signed-in member and signed by their device through the relay, with
// the reactions to it committed in its transaction, each an effect citing
// it, so the member signs the decision alone. A refusal or a failure is a
// 4xx, so the form keeps what was typed; a write past the relay's caps
// fails before it starts, a 429. The run holds no connection while it
// waits on the signature: its reads borrow one each, and its write one
// for its transaction once it is signed. The post that starts it, and the
// post carrying the proof back, is answered with the run's next step:
// what the device is to sign, or the outcome.
export async function perform(event: RequestEvent, collection: string, name: string, id?: string) {
  const write = action(collection, name)
  if (!write) {
    error(404, `${collection} has no write ${name}`)
  }
  const s = event.locals.session
  if (!s) {
    return fail(401, { done: { op: write.op, state: 'failed', reason: 'sign in first', then: [] } satisfies Done })
  }
  const data = await event.request.formData()
  const owner = `${s.actor} ${s.device}`
  const run = data.get('cella-run')
  if (typeof run === 'string') {
    return relayed(owner, run, data)
  }
  const form = await fields(data)
  const address = await using(s.actor, scope)
  if (!address) {
    return fail(503, { done: { op: write.op, state: 'failed', reason: 'the database names no scope', then: [] } satisfies Done })
  }
  const started = relay(owner, { scope: address, actor: s.actor, device: s.device }, async (sign) => {
    const deps = reacting({ ...lent((fn) => using(s.actor, fn)), actor: s.actor, sign })
    let result: Awaited<ReturnType<typeof write.run>>
    try {
      result = await write.run(form, deps, id)
    } catch (e) {
      return fail(400, { done: { op: write.op, state: 'failed', reason: reason(e), then: [] } satisfies Done })
    }
    const { done } = result
    return done.state === 'refused' ? fail(422, { done }) : { done }
  })
  if (typeof started === 'string') {
    return fail(429, { done: { op: write.op, state: 'failed', reason: started, then: [] } satisfies Done })
  }
  return step(started)
}

// A proof the browser posts back to the run it answers, which goes on to
// its next step; a run that is not the poster's, or is over, is gone.
export async function relayed(owner: string, id: string, data: FormData) {
  const run = answered(id, owner)
  const p = proof(String(data.get('cella-proof') ?? ''))
  if (!run || !p) {
    return fail(409, { done: { op: 'none:none:none', state: 'failed', reason: 'this write is over, or is not yours to sign', then: [] } satisfies Done })
  }
  run.give(p)
  return step(run)
}

// What a post is answered with: the signature the run asks for, or its
// outcome.
export async function step<R>(run: { next(): Promise<{ ask: Ask } | { result: R } | { error: unknown }> }) {
  const s = await run.next()
  if ('ask' in s) {
    return { sign: s.ask }
  }
  if ('error' in s) {
    throw s.error
  }
  return s.result
}
