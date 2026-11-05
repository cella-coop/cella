import { randomBytes } from 'node:crypto'
import type { Json, Proof, Signer } from '@cella/org-sign'
import { CELLA_PATIENCE, CELLA_PENDING } from '$app/env/private'

// A write the member's device signs, relayed: the server never holds a
// member's key, so a write from a page runs here while the browser signs.
// Each time a handler signs (`Deps.sign`, before its transaction opens),
// the run stops and the page's post is answered with what to sign: the
// op, the request made plain, and the scope, actor and device the
// signature names. The browser signs it with the device it keeps and
// posts the proof back to the same action, naming the run; the run goes
// on to its outcome, the decision and its effects committed together, since
// a reaction asks for no signature of its own. A run is its
// owner's alone, and gives up when a proof does not come in time. A run
// is pending from its start to its outcome: a person has at most `EACH`
// pending, counted by actor across their devices and sessions, and the
// server at most `CELLA_PENDING` of everyone's, so a run past either is
// refused before it starts, never queued.

// What a device is asked to sign.
export interface Ask {
  run: string
  op: string
  request: Json
  scope: string
  actor: string
  device: string
}

type Step<R> = { ask: Ask } | { result: R } | { error: unknown }

// How long a run waits for each signature.
const PATIENCE = CELLA_PATIENCE * 1000

// How many runs one person may have pending.
const EACH = 3

const runs = new Map<string, Run<unknown>>()

class Run<R> {
  readonly id = randomBytes(16).toString('hex')
  #steps: Step<R>[] = []
  #waiting: ((s: Step<R>) => void) | undefined
  #proof: { resolve: (p: Proof) => void; reject: (e: Error) => void } | undefined
  #timer: ReturnType<typeof setTimeout> | undefined

  constructor(
    readonly owner: string,
    readonly signs: { scope: string; actor: string; device: string },
  ) {}

  #push(s: Step<R>) {
    const w = this.#waiting
    if (w) {
      this.#waiting = undefined
      w(s)
    } else {
      this.#steps.push(s)
    }
  }

  // Signs by asking the device, and waits for its proof.
  sign: Signer = (op, request) =>
    new Promise<Proof>((resolve, reject) => {
      this.#proof = { resolve, reject }
      this.#timer = setTimeout(() => this.#give(new Error('no signature came from the device in time')), PATIENCE)
      this.#push({ ask: { run: this.id, op, request, ...this.signs } })
    })

  #give(p: Proof | Error) {
    clearTimeout(this.#timer)
    const proof = this.#proof
    this.#proof = undefined
    if (p instanceof Error) {
      proof?.reject(p)
    } else {
      proof?.resolve(p)
    }
  }

  // Hands the run the proof its last ask waits for.
  give(p: Proof) {
    this.#give(p)
  }

  finish(s: { result: R } | { error: unknown }) {
    runs.delete(this.id)
    this.#push(s)
  }

  // The run's next step: a signature to ask for, or its outcome.
  next(): Promise<Step<R>> {
    const s = this.#steps.shift()
    return s ? Promise.resolve(s) : new Promise((resolve) => (this.#waiting = resolve))
  }
}

// Why a run for `actor` may not start now, if it may not.
function full(actor: string): string | null {
  if ([...runs.values()].filter((r) => r.signs.actor === actor).length >= EACH) {
    return `you have ${EACH} writes waiting on your signature; sign them or wait for them to end, then try again`
  }
  if (runs.size >= CELLA_PENDING) {
    return 'the server has as many writes waiting on a signature as it takes; try again shortly'
  }
  return null
}

// Starts a run of `work`, signing as `signs` through the device; `owner`
// names who may answer it, such as the session that asked. A run past a
// cap does not start: it is why, as the page may say it.
export function relay<R>(owner: string, signs: Run<R>['signs'], work: (sign: Signer) => Promise<R>): Run<R> | string {
  const refused = full(signs.actor)
  if (refused) {
    return refused
  }
  const run = new Run<R>(owner, signs)
  runs.set(run.id, run as Run<unknown>)
  work(run.sign).then(
    (result) => run.finish({ result }),
    (error: unknown) => run.finish({ error }),
  )
  return run
}

// The run a proof answers, if `owner` holds it.
export function answered(id: string, owner: string): Run<unknown> | null {
  const run = runs.get(id)
  return run && run.owner === owner ? run : null
}

// A proof as the browser posts it, if it is one.
export function proof(text: string): Proof | null {
  try {
    const p = JSON.parse(text) as Record<string, unknown>
    return ['device', 'salt', 'nonce', 'sig'].every((k) => typeof p[k] === 'string') ? (p as unknown as Proof) : null
  } catch {
    return null
  }
}
