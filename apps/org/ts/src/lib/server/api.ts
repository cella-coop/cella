import type { Schema } from '@cella/org-db'
import type { Proof } from '@cella/org-sign'
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
