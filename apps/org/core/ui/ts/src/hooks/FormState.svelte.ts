import { bound } from '../models/bound.ts'

// A write's form while it posts: pending from submit until the page has
// its outcome, so a second press does not sign the write twice; and the
// remote form it posts to, which every field in it is bound to by name
// (`bound`), so a field names itself through it. Outside a form, a field
// keeps its name.
export class FormState {
  pending = $state(false)
  // Why the last post was refused, where the form says so itself, as a
  // create form in New's dialog does.
  problem = $state<string | null>(null)
  #form: (() => string) | null = null

  // The remote form, `<hash>/<name>`, the fields bind to.
  bind(form: () => string) {
    this.#form = form
  }

  // A field's name as the form posts it.
  name(name: string): string {
    return this.#form ? bound(name, this.#form()) : name
  }

  // Starts a post, or says one is already under way.
  start(): boolean {
    if (this.pending) {
      return false
    }
    this.pending = true
    return true
  }

  done() {
    this.pending = false
  }
}
