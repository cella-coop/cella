import type { Outcome } from '../models/outcome.ts'

// The shell's own state: the last write's outcome, until it is dismissed,
// and whether the drawer is open, which the viewer's cookie keeps so the
// server renders the page as they left it.
export class ShellState {
  #dismissed: Outcome | null = $state.raw(null)
  readonly #outcome: () => Outcome | null
  drawer = $state(true)
  // The drawer's open panel, by id; a page without it opens its first.
  panel: string | null = $state(null)

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

  choose(panel: string) {
    this.panel = panel
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
