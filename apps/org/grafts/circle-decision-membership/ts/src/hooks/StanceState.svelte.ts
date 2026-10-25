// The stance form's choice: the acting member's latest stance as the
// server read it, until they choose another; the form posts only a
// change.
export class StanceState {
  chosen = $state('')
  readonly #current: () => string

  constructor(current: () => string) {
    this.#current = current
    this.chosen = current()
  }

  changed = $derived.by(() => this.chosen !== '' && this.chosen !== this.#current())
}
