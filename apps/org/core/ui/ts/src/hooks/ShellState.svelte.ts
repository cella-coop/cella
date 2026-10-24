import type { Outcome } from '../models/outcome.ts'

// The shell's own state: the last write's outcome, until it is dismissed,
// and whether the drawer is open, which the viewer's cookie keeps so the
// server renders the page as they left it.
export class ShellState {
  #dismissed: Outcome | null = $state.raw(null)
  readonly #outcome: () => Outcome | null
  drawer = $state(true)

  constructor(outcome: () => Outcome | null, drawer: () => boolean) {
    this.#outcome = outcome
    this.drawer = drawer()
  }

  outcome = $derived.by(() => {
    const o = this.#outcome()
    return o && o !== this.#dismissed ? o : null
  })

  dismiss() {
    this.#dismissed = this.#outcome()
  }

  show(open = !this.drawer) {
    this.drawer = open
    try {
      document.cookie = `cella-drawer=${open ? 'open' : 'closed'}; path=/; max-age=31536000; samesite=lax`
    } catch {
      // Without the cookie the drawer still toggles; it only opens again
      // on the next visit.
    }
  }
}
