import type { Cookies } from '@sveltejs/kit'
import type { Db, Schema } from '@cella/org-db'
import type { Proof } from '@cella/org-sign'
import { Missing, type Reader } from './calls.ts'
import { using } from './db.ts'
import type { Answer, Fields } from './write.ts'

// What a client posts to `POST /api/<feat>/<verb>`: a command, its fields
// by name, each a text or a list of texts, the item it is on, `id`, and
// which collection's form runs it, `form`, as `tasks.create`, where more
// than one does; or the proof its device signed for the run that asked,
// posted back to the same address.
export type Called = { fields: Fields; id?: string; form?: string } | { run: string; proof: Proof }

const MOST = 1 << 22

const text = (x: unknown): x is string => typeof x === 'string' && x.length <= MOST

export const called: Schema<Called> = {
  '~standard': {
    version: 1,
    vendor: 'cella',
    validate(value) {
      const v = value as Record<string, unknown> | null
      if (!v || typeof v !== 'object' || Array.isArray(v)) {
        return { issues: [{ message: 'a command is posted as an object of its fields, or a run and its proof' }] }
      }
      if ('run' in v) {
        const p = v.proof as Record<string, unknown> | null
        if (!text(v.run) || !p || typeof p !== 'object' || !['device', 'salt', 'nonce', 'sig'].every((k) => text(p[k]))) {
          return { issues: [{ message: 'a proof names its run and carries the device, salt, nonce and sig its device signed', path: ['proof'] }] }
        }
        return { value: { run: v.run, proof: { device: p.device, salt: p.salt, nonce: p.nonce, sig: p.sig } as Proof } }
      }
      const extra = Object.keys(v).filter((k) => !['fields', 'id', 'form'].includes(k))
      if (extra.length) {
        return { issues: extra.map((k) => ({ message: `${k} is not asked for`, path: [k] })) }
      }
      for (const k of ['id', 'form'] as const) {
        if (k in v && !text(v[k])) {
          return { issues: [{ message: `${k} is a text`, path: [k] }] }
        }
      }
      const given = (v.fields ?? {}) as Record<string, unknown>
      if (typeof given !== 'object' || Array.isArray(given)) {
        return { issues: [{ message: 'fields is an object of the write’s fields by name', path: ['fields'] }] }
      }
      const fields: Fields = new Map()
      for (const [k, x] of Object.entries(given)) {
        const values = [x].flat()
        if (!values.every(text)) {
          return { issues: [{ message: `${k} is a text or a list of texts`, path: ['fields', k] }] }
        }
        fields.set(k, values)
      }
      return { value: { fields, id: v.id as string | undefined, form: v.form as string | undefined } }
    },
  },
}

// An answer as the endpoint sends it: what to sign, 202, or the outcome
// with its status, a Pending 202 as it is taken and not yet decided.
export function reply(a: Answer): Response {
  if ('sign' in a) {
    return Response.json({ sign: a.sign }, { status: 202 })
  }
  return Response.json({ done: a.done }, { status: a.done?.state === 'pending' ? 202 : a.status })
}

// A query over HTTP, for a client with no page: its argument validated by
// the query's own schema, a 400 naming what is wrong, then run as the
// session's person through `using`, as a page's read is, so the row-level
// policies decide what it reads; what is missing or not the reader's is a
// 404, as on a page. The answer is the query's, as JSON.
export async function fetched<A>(
  call: { schema: Schema<A>; run(db: Db, arg: A, who: Reader): Promise<unknown> },
  arg: unknown,
  locals: App.Locals,
  cookies: Cookies,
): Promise<Response> {
  const checked = call.schema['~standard'].validate(arg)
  if ('issues' in checked) {
    return Response.json({ reason: checked.issues.map((i) => i.message).join('; ') }, { status: 400 })
  }
  try {
    const read = await using(locals.actor, (db) => call.run(db, checked.value, { actor: locals.actor, session: locals.session, cookies }))
    return Response.json(read)
  } catch (e) {
    if (e instanceof Missing) {
      return Response.json({ reason: e.message }, { status: 404 })
    }
    throw e
  }
}
