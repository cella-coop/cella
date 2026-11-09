import { getRequestEvent, requested, type RemoteQueryFunction } from '$app/server'
import type { Action } from '@cella/org-db'
import { unbound } from '@cella/org-ui/models'
import { failed, perform, type Answer, type Fields, type Poster } from '#lib/server/write.ts'

// A write's address, as its page posts it: the collection, and the item
// on an item's page, or the settings page; with the write's name and, for
// a form, which of the page's forms it is, so each form binds an
// instance of its own (`write.for(key)`).
export interface Key {
  at: Record<string, string>
  write: string
}

// The key a form posts, or why it is no write's.
export function keyed(given: unknown, shape: readonly string[], optional: readonly string[] = []): Key | string {
  let key: unknown = given
  if (typeof given === 'string') {
    try {
      key = JSON.parse(given)
    } catch {
      return 'this form names no write'
    }
  }
  const k = key as { at?: unknown; write?: unknown } | null
  const at = k?.at as Record<string, unknown> | undefined
  if (!k || typeof k.write !== 'string' || !at || typeof at !== 'object') {
    return 'this form names no write'
  }
  const names = Object.keys(at)
  if (!shape.every((s) => typeof at[s] === 'string') || !names.every((n) => shape.includes(n) || (optional.includes(n) && typeof at[n] === 'string'))) {
    return `a write here is posted from ${shape.join(' and ')}`
  }
  return { at: at as Record<string, string>, write: k.write }
}

// What a `write` form posts: its fields, bound to it as `f.<name>[]`, by
// the names the page gave them (`bound` in `@cella/org-ui/models`).
export function posted(data: unknown): Fields {
  const f = (data as { f?: unknown } | null)?.f
  const out: Fields = new Map()
  if (f && typeof f === 'object') {
    for (const [k, v] of Object.entries(f)) {
      out.set(
        unbound(k),
        [v].flat().filter((x): x is string | File => typeof x === 'string' || x instanceof File),
      )
    }
  }
  return out
}

// What a `send` posts: its fields as pairs, in order.
export function pairs(given: [string, string][]): Fields {
  const out: Fields = new Map()
  for (const [k, v] of given) {
    out.set(k, [...(out.get(k) ?? []), v])
  }
  return out
}

// The session's member and device, if one is signed in.
export function poster(): Poster | null {
  const s = getRequestEvent().locals.session
  return s ? { actor: s.actor, device: s.device } : null
}

// Runs a write a page posts, by a form or a command: a form posted with
// no script is answered at once, since only the page's script signs.
export async function written(write: Action | undefined, name: string, data: Fields, id?: string): Promise<Answer> {
  if (!write) {
    return failed(404, `there is no write ${name} here`)
  }
  if (!getRequestEvent().isRemoteRequest) {
    return failed(400, 'a write is signed in the browser by the page’s script: turn JavaScript on and send it again', write.op)
  }
  return perform(poster(), write, data, id)
}

// The queries a write may touch, which the page reading them asks to
// have back with the write's outcome.
type Touched = RemoteQueryFunction<any, any>

// An answer with what the page asked to have refreshed, in the same
// response: every query instance it names, read again after the write.
export async function answer(a: Answer, touched: Touched[]): Promise<Answer> {
  await Promise.all(touched.map((q) => requested(q, 32).refreshAll()))
  return a
}
