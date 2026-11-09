import { lent, type Action, type Done, type Form, type Upload } from '@cella/org-db'
import { scope } from '@cella/org-log/api'
import { using } from './db.ts'
import { answered, proof, relay, type Ask } from './relay.ts'
import { reacting } from './slices.ts'

// What a write's post is answered with: what the device is to sign, or
// the write's outcome with the status a plain HTTP answer would carry, a
// 4xx for a write refused or failed, so a form keeps what was typed; a
// save that is no write of the log's, as a theme kept in a cookie, names
// no outcome.
export type Answer = { sign: Ask } | { done?: Done; status: number }

// A write that never reached a verdict, said as its answer.
export const failed = (status: number, reason: string, op: Done['op'] = 'none:none:none'): Answer => ({
  done: { op, state: 'failed', reason, then: [] },
  status,
})

// What a write posts: each field's values in order, as text or a file, by
// the name the page gave it.
export type Fields = Map<string, (string | File)[]>

// A form's fields as text, and the files it carries read whole; a file
// input left empty carries no file.
export async function fields(data: Fields): Promise<Form> {
  const files = new Map<string, Upload>()
  for (const [name, values] of data) {
    const file = values.find((v): v is File => typeof v !== 'string' && v.size > 0)
    if (file) {
      files.set(name, { name: file.name, type: file.type || 'application/octet-stream', bytes: new Uint8Array(await file.arrayBuffer()) })
    }
  }
  const all = (name: string) => (data.get(name) ?? []).flatMap((v) => (typeof v === 'string' ? [v] : []))
  return {
    get: (name) => all(name)[0] ?? '',
    all,
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

// Who posts a write: the session's member and the device it signs by.
export interface Poster {
  actor: string
  device: string
}

// One write from a page: the write its collection's slices name, run as
// the signed-in member and signed by their device through the relay, with
// the reactions to it committed in its transaction, each an effect citing
// it, so the member signs the decision alone. A write past the relay's
// caps fails before it starts, a 429. The run holds no connection while it
// waits on the signature: its reads borrow one each, and its write one
// for its transaction once it is signed. The post that starts it, and the
// `prove` carrying the proof back, is answered with the run's next step:
// what the device is to sign, or the outcome.
export async function perform(who: Poster | null, write: Action, data: Fields, id?: string): Promise<Answer> {
  if (!who) {
    return failed(401, 'sign in first', write.op)
  }
  const form = await fields(data)
  const address = await using(who.actor, scope)
  if (!address) {
    return failed(503, 'the database names no scope', write.op)
  }
  const started = relay(owner(who), { scope: address, actor: who.actor, device: who.device }, async (sign): Promise<Answer> => {
    const deps = reacting({ ...lent((fn) => using(who.actor, fn)), actor: who.actor, sign })
    let result: Awaited<ReturnType<typeof write.run>>
    try {
      result = await write.run(form, deps, id)
    } catch (e) {
      return failed(400, reason(e), write.op)
    }
    const { done } = result
    return { done, status: done.state === 'refused' ? 422 : 200 }
  })
  if (typeof started === 'string') {
    return failed(429, started, write.op)
  }
  return step(started)
}

// Who may answer a run a session started.
export const owner = (who: Poster) => `${who.actor} ${who.device}`

// A proof the browser posts back to the run it answers, which goes on to
// its next step; a run that is not the poster's, or is over, is gone.
export async function relayed(owner: string, id: string, text: string): Promise<Answer> {
  const run = answered(id, owner)
  const p = proof(text)
  if (!run || !p) {
    return failed(409, 'this write is over, or is not yours to sign')
  }
  run.give(p)
  return step(run as Parameters<typeof step<Answer>>[0])
}

// What a post is answered with: the signature the run asks for, or its
// outcome.
export async function step<R>(run: { next(): Promise<{ ask: Ask } | { result: R } | { error: unknown }> }): Promise<R | { sign: Ask }> {
  const s = await run.next()
  if ('ask' in s) {
    return { sign: s.ask }
  }
  if ('error' in s) {
    throw s.error
  }
  return s.result
}
