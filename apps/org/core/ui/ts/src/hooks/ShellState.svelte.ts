import type { Outcome } from '../models/outcome.ts'

// The shell's own state: the last write's outcome, until it is dismissed,
// whether the drawer is open, which the viewer's cookie keeps so the
// server renders the page as they left it, and the names of the people
// the co-op knows, by address, which a person's chip shows.
export class ShellState {
  #dismissed: Outcome | null = $state.raw(null)
  readonly #outcome: () => Outcome | null
  readonly #names: () => Record<string, string>
  drawer = $state(true)
  // The drawer's open panel, by id; a page without it opens its first.
  panel: string | null = $state(null)

  constructor(outcome: () => Outcome | null, drawer: () => boolean, names: () => Record<string, string>) {
    this.#outcome = outcome
    this.#names = names
    this.drawer = drawer()
  }

  // A person's name by their address, or none where the co-op knows no
  // one by it.
  name(address: string): string | undefined {
    return this.#names()[address]
  }

  outcome = $derived.by(() => {
    const o = this.#outcome()
    return o && o !== this.#dismissed ? o : null
  })

  dismiss() {
    this.#dismissed = this.#outcome()
  }

  // A panel's tab opens the drawer on it.
  choose(panel: string) {
    this.panel = panel
    if (!this.drawer) {
      this.show(true)
    }
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
