import type { Outcome } from '../models/outcome.ts'

// The shell's own state: the last write's outcome, until it is dismissed.
export class ShellState {
  #dismissed: Outcome | null = $state.raw(null)
  readonly #outcome: () => Outcome | null

  constructor(outcome: () => Outcome | null) {
    this.#outcome = outcome
  }

  outcome = $derived.by(() => {
    const o = this.#outcome()
    return o && o !== this.#dismissed ? o : null
  })

  dismiss() {
    this.#dismissed = this.#outcome()
  }
}
