import { b64, type Joined, type Kept, type Merged } from '../models/body.ts'
import type { Heard, Session } from './session.ts'

// Where a request for a body comes from: its collection, its record, the
// signed-in person, or no one, and the request.
export interface At {
  kind: string
  record: string
  actor: string | null
  request: Request
}

// A save as a peer hears it and as the post telling of one is answered:
// the snapshot the record holds, its version vector and hash, and who
// contributed since.
const kept = (s: { saved: Uint8Array; snapshot: Uint8Array; base: string; contributors: string[] }): Kept => ({
  saved: b64.encode(s.saved),
  snapshot: b64.encode(s.snapshot),
  base: s.base,
  contributors: s.contributors,
})

const encoder = new TextEncoder()
const event = (name: string, data: unknown) => encoder.encode(`event: ${name}\ndata: ${JSON.stringify(data)}\n\n`)

// A form's post answered as SvelteKit answers one, which the editor's
// sync reads: a success, with what it answers, or a failure with the
// reason.
const answer = (status: number, reason?: string, data?: unknown) =>
  Response.json(
    reason === undefined
      ? { type: 'success', status, data }
      : { type: 'failure', status, data: { done: { op: 'body', state: 'refused', reason, then: [] } } },
    { status: reason === undefined ? 200 : status },
  )

// GET `/<collection>/<record>/body/live`: the body's session, as
// server-sent events. It opens with `joined`, whether this peer may
// edit, its address, the save action its browser saves through, the
// session's version vector, the last save's, who contributed since and
// the hash of the body the record holds (`Joined`), and an `update`
// holding everything it lacks by the Loro version vector it sends
// (`vv`); its browser's Loro peer is `peer`.
// Then each update merged, from any peer, its receipt 0, since it has
// none until a save, with who contributed since the last save
// (`Merged`); `saved`, each save the session learns of, with the
// snapshot and its hash (`Kept`); and
// `dropped`, why, when the session drops it, which closes the stream. A
// comment line every 20 seconds keeps proxies from closing a quiet
// stream; the peer leaves when the stream closes.
export async function open(session: Session, at: At): Promise<Response> {
  if (!session.keeps(at.kind)) {
    return new Response(`${at.kind} keeps no body`, { status: 404 })
  }
  if (!at.actor) {
    return new Response('sign in first', { status: 401 })
  }
  const actor = at.actor
  const params = new URL(at.request.url).searchParams
  const joined = await session.join(at.kind, at.record, actor, params.get('vv'), params.get('peer'))
  if (!joined) {
    return new Response(`${at.kind} has no ${at.record} you read`, { status: 404 })
  }
  const { peer } = joined
  let stop = () => {}
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      const beat = setInterval(() => c.enqueue(encoder.encode(': beat\n\n')), 20_000)
      const close = () => {
        try {
          c.close()
        } catch {
          // the client closed it already
        }
      }
      stop = () => {
        clearInterval(beat)
        peer.leave()
      }
      at.request.signal.addEventListener('abort', () => {
        stop()
        close()
      })
      c.enqueue(
        event('joined', {
          writable: peer.writable,
          actor,
          save: joined.save,
          version: b64.encode(joined.version),
          saved: b64.encode(joined.saved),
          contributors: joined.contributors,
          base: joined.base,
        } satisfies Joined),
      )
      c.enqueue(event('update', { receipt: 0, update: b64.encode(joined.update), contributors: joined.contributors } satisfies Merged))
      peer.listen((h: Heard) => {
        if (h.type === 'update') {
          c.enqueue(event('update', { receipt: 0, update: b64.encode(h.update), contributors: h.contributors } satisfies Merged))
        } else if (h.type === 'saved') {
          c.enqueue(event('saved', kept(h)))
        } else {
          c.enqueue(event('dropped', { reason: h.reason }))
          clearInterval(beat)
          close()
        }
      })
    },
    cancel() {
      stop()
    },
  })
  return new Response(body, { headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' } })
}

// POST `/<collection>/<record>/body/live`, from a peer that has the body
// open: a Loro update, in base64, in the form's `update` field; or
// `saved`, that its browser saved the body through the feat's action,
// answered with the body the record holds now (`Kept`), as a browser whose
// save was refused for its `base` posts it to read the body again.
export async function post(session: Session, at: At): Promise<Response> {
  if (!session.keeps(at.kind)) {
    return answer(404, `${at.kind} keeps no body`)
  }
  if (!at.actor) {
    return answer(401, 'sign in first')
  }
  const form = await at.request.formData()
  if (form.has('saved')) {
    const out = await session.saved(at.kind, at.record, at.actor)
    if (out.state === 'refused') {
      return answer(403, out.reason)
    }
    return answer(200, undefined, out.state === 'saved' ? kept(out) : undefined)
  }
  const update = form.get('update')
  if (typeof update !== 'string' || !update) {
    return answer(400, 'the post carries no update')
  }
  const out = await session.post(at.kind, at.record, at.actor, b64.decode(update))
  return out.state === 'refused' ? answer(403, out.reason) : answer(200)
}
