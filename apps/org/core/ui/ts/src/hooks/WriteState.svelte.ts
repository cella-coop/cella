import type { Outcome } from '../models/outcome.ts'
import { lost, post, took, type Answer } from '../post.ts'

// A remote command's call, whose answer may carry the queries it asks
// refreshed (`updates`), as SvelteKit's are.
type Updating<T> = Promise<T> & { updates(...queries: unknown[]): Promise<T> }

// A `write` form's instance as SvelteKit's remote `form` makes it, as
// much of it as a form uses: its action, and its submit handed to the
// form's own handler, with the answer it gave.
export interface Submitting {
  submit(): Updating<boolean>
  readonly result: unknown
  readonly element: HTMLFormElement
}

export interface WriteForm {
  readonly action: string
  enhance(handle: (f: Submitting) => Promise<void>): object
}

// How a page's writes reach the server, which the route that mounts the
// page names: its `write` form for each write, an instance a form, its
// `send` command for a write its script posts, the shell's `prove`, the
// queries the page reads that a write may change, and how the page reads
// again, its shell's counts and theme after a write that took or reached a verdict
// (`after`) and all of it after a write the server refused before any
// signature (`again`), so what a drop moved goes back.
export interface Route {
  form(write: string, n: string): WriteForm
  // The write's item, and its collection where it is not the page's.
  send(write: string, fields: [string, string][], id?: string, collection?: string): Updating<Answer>
  prove(run: string, proof: string): Updating<Answer>
  touched: unknown[]
  after(): Promise<void>
  again(): Promise<void>
}

// A page's writes while it is open, and the last outcome, which the shell
// shows: each write signed as `post` signs it, its proof posted back with
// the page's queries asked for, so the outcome comes back with them in
// one flight; the shell's own counts are read again after a write that
// took or reached a verdict, as the route says.
export class WriteState {
  done = $state<Outcome | null>(null)
  #route: (() => Route) | null = null
  // Who this browser is signed in as, and the demo copy it is on, if any:
  // its join code, fresh on every copy and on every reset of one, empty
  // outside a demo. The root layout names both, by a getter over the one
  // query every page awaits, so a kept draft can be namespaced by them
  // without a slice's own hook asking the server again.
  #actor: () => string = () => ''
  #copy: () => string = () => ''

  // The route the page is on names how its writes are posted.
  serve(route: () => Route) {
    this.#route = route
  }

  // Named by the root layout, once per page: who is signed in, and which
  // demo copy, so every kept draft is namespaced by both and never
  // replays for the wrong person or into a copy a reset has moved past.
  identify(actor: () => string, copy: () => string) {
    this.#actor = actor
    this.#copy = copy
  }

  get actor(): string {
    return this.#actor()
  }

  get copy(): string {
    return this.#copy()
  }

  get route(): Route {
    if (!this.#route) {
      throw new Error('no route names how this page writes')
    }
    return this.#route()
  }

  // Signs and posts a write whose first post is `start`.
  async post(start: () => Promise<Answer>): Promise<Answer> {
    const r = this.route
    const answer = await post(start, (run, proof) => r.prove(run, proof).updates(...r.touched))
    if (took(answer) || ('done' in answer && answer.done && ['refused', 'pending'].includes(answer.done.state))) {
      await r.after()
    }
    return answer
  }

  // A write the page's script posts, as a drop does; one the server
  // answers before any signature changed nothing, but the page reads
  // again so what it moved goes back.
  async send(write: string, fields: [string, string][], id?: string, collection?: string): Promise<Answer> {
    let first = true
    const r = this.route
    const answer = await this.post(async () => {
      const a = await r.send(write, fields, id, collection).updates()
      first = first && !('sign' in a)
      return a
    })
    if (first && !took(answer)) {
      await r.again()
    }
    return answer
  }

  // A write's answer, shown: one that never came is unknown.
  async shown(posting: Promise<Answer>): Promise<Answer> {
    const answer = await posting.catch(lost)
    if ('done' in answer && answer.done) {
      this.done = answer.done
    }
    return answer
  }

  dismiss() {
    this.done = null
  }
}
