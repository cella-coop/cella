import { parse } from 'devalue'
import { signer, type Json } from '@cella/org-sign'
import { held } from './hooks/kept.svelte.ts'

// An action's result as SvelteKit answers a form's post, which
// `applyAction` takes.
export type Result =
  | { type: 'success' | 'failure'; status: number; data?: Record<string, unknown>; location: string }
  | { type: 'redirect'; status: number; location: string }
  | { type: 'error'; status?: number; error: { status: number; message: string } }

// What the server asks a device to sign, as `relay.ts` in the shell says.
interface Ask {
  run: string
  op: string
  request: Json
  scope: string
  actor: string
  device: string
}

const asked = (r: Result): Ask | null =>
  r.type === 'success' && r.data && typeof r.data === 'object' && 'sign' in r.data ? (r.data.sign as Ask) : null

const failed = (status: number, reason: string): Result => ({
  type: 'failure',
  status,
  location: location.href,
  data: { done: { op: 'none:none:none', state: 'failed', reason, then: [] } },
})

async function send(url: string, body: FormData): Promise<Result> {
  const res = await fetch(url, { method: 'POST', body, headers: { 'x-sveltekit-action': 'true', accept: 'application/json' } })
  if (res.status === 401) {
    return failed(401, 'sign in first')
  }
  // The data is devalue's, as SvelteKit's `deserialize` reads it.
  const r = JSON.parse(await res.text()) as Result
  if ((r.type === 'success' || r.type === 'failure') && typeof r.data === 'string') {
    return { ...r, data: parse(r.data) as Record<string, unknown> }
  }
  return r
}

// Posts a write's form to a page's action, as every form and drop does,
// and signs what the server asks with the device this browser keeps: the
// write itself, then each write that reacts to it. Each signature is made
// here, by the key this browser made or was given, and never leaves it;
// the post carrying it back names the run it answers. Ends with the
// write's outcome, as an enhanced form's.
export async function post(url: string, body: FormData): Promise<Result> {
  let result = await send(url, body)
  for (let ask = asked(result); ask; ask = asked(result)) {
    const device = await held(ask.scope, ask.device)
    if (!device || device.address !== ask.actor) {
      return failed(403, `this browser holds no device of ${ask.actor} to sign with`)
    }
    const proof = await signer(ask.scope, ask.actor, device)(ask.op, ask.request)
    const next = new FormData()
    next.set('cella-run', ask.run)
    next.set('cella-proof', JSON.stringify(proof))
    result = await send(url, next)
  }
  return result
}
