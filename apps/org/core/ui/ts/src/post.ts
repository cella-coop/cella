import { signer, type Json } from '@cella/org-sign'
import { held } from './hooks/kept.svelte.ts'
import { none, type Outcome } from './models/outcome.ts'

// What the server asks a device to sign, as `relay.ts` in the shell says.
export interface Ask {
  run: string
  op: string
  request: Json
  scope: string
  actor: string
  device: string
}

// What a write's post is answered with, as `write.ts` in the shell says:
// what to sign, or the outcome with the status a plain HTTP answer would
// carry; a save that is no write of the log's names no outcome.
export type Answer = { sign: Ask } | { done?: Outcome; status: number }

export const failed = (status: number, reason: string, state: Outcome['state'] = 'failed'): Answer => ({
  status,
  done: { op: none, state, reason, then: [] },
})

// Whether a write's answer is its outcome and took.
export const took = (a: Answer): boolean => !('sign' in a) && a.status < 400

// What a form shows when its post got no answer it could read: the
// connection dropped, or something on the way answered in the server's
// place. The server may have written it all the same, so the outcome is
// unknown. `post` itself throws then, which the editor's sync reads as
// being offline.
export const lost = () =>
  failed(504, 'it may have been written all the same: reload the page to see what stands before sending it again', 'unknown')

// Posts a write, as every form and drop does, and signs what the server
// asks with the device this browser keeps: the write itself, then each
// write that reacts to it. `start` is its first post, the page's `write`
// form submitted or a command sent; `prove` posts each proof back, naming
// the run it answers. Each signature is made here, by the key this
// browser made or was given, and never leaves it. Ends with the write's
// outcome.
export async function post(start: () => Promise<Answer>, prove: (run: string, proof: string) => Promise<Answer>): Promise<Answer> {
  let answer = await start()
  while ('sign' in answer) {
    const ask = answer.sign
    const device = await held(ask.scope, ask.device)
    if (!device || device.address !== ask.actor) {
      return failed(403, `this browser holds no device of ${ask.actor} to sign with`)
    }
    const proof = await signer(ask.scope, ask.actor, device)(ask.op, ask.request)
    answer = await prove(ask.run, JSON.stringify(proof))
  }
  return answer
}
