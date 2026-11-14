import { afterNavigate } from '$app/navigation'
import type { Outcome } from '../models/outcome.ts'

// The circle a member lenses the co-op on, from the co-op selector.
export interface Lens {
  id: string
  name: string
}

// The shell's own state: the last write's outcome, until it is dismissed,
// whether the drawer is open, which the viewer's cookie keeps so the
// server renders the page as they left it, the names of the people the
// co-op knows, by address, which a person's chip shows, the names of the
// circles the member reads, by id, which a circle's column shows, and the circle
// the member lensed the co-op on, which the server read from their cookie.
export class ShellState {
  #dismissed: Outcome | null = $state.raw(null)
  readonly #outcome: () => Outcome | null
  readonly #names: () => Record<string, string>
  readonly #lens: () => Lens | null
  readonly #circles: () => Lens[]
  drawer = $state(true)
  // The drawer's open panel, by id; a page without it opens its first.
  panel: string | null = $state(null)
  // The sidebar's accordions the viewer opened or shut, by key; one they
  // never touched is open while it holds the page, shut otherwise.
  toggled: Record<string, boolean> = $state({})
  // The last page outside settings, where settings' back link returns.
  left = $state('/inbox')

  constructor(
    outcome: () => Outcome | null,
    drawer: () => boolean,
    names: () => Record<string, string>,
    lens: () => Lens | null = () => null,
    circles: () => Lens[] = () => [],
  ) {
    this.#outcome = outcome
    this.#names = names
    this.#lens = lens
    this.#circles = circles
    this.drawer = drawer()
  }

  // Keeps `left` on the page the viewer is on while it is not a page of
  // settings, each time the viewer arrives on one; called once, as the
  // shell starts.
  follow(path: () => string, away: () => boolean) {
    afterNavigate(() => {
      if (!away()) {
        this.left = path()
      }
    })
  }

  // A person's name by their address, or none where the co-op knows no
  // one by it.
  name(address: string): string | undefined {
    return this.#names()[address]
  }

  // A circle's name by its id, or none where the member reads no circle
  // by it.
  circle(id: string): string | undefined {
    return this.#circles().find((c) => c.id === id)?.name
  }

  // The circle every collection reads through, or none.
  get lens(): Lens | null {
    return this.#lens()
  }

  outcome = $derived.by(() => {
    const o = this.#outcome()
    return o && o !== this.#dismissed ? o : null
  })

  dismiss() {
    this.#dismissed = this.#outcome()
  }

  // Whether an accordion is open: as the viewer left it, else open where
  // it holds the page.
  expanded(key: string, holds: boolean): boolean {
    return this.toggled[key] ?? holds
  }

  toggle(key: string, holds: boolean) {
    this.toggled[key] = !this.expanded(key, holds)
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
