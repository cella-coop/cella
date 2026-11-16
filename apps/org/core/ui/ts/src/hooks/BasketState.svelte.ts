import { put, read, removed, spelt, waiting, type Basket, type Change } from '../models/basket.ts'
import type { Decider } from '../models/settings.ts'

// The changes to propose on the settings pages, a basket for each circle
// that decides, kept in the session's cookie so they outlast a reload and
// a move between pages; the basket under review, in its dialog while it
// is open, whether its proposal is posting and why it was not proposed.
// The browser alone holds the cookie: the page reads it as it mounts
// (`load`), so the server renders the page with none.
export class BasketState {
  baskets = $state<Basket[]>([])
  reviewing = $state<string | null>(null)
  dialog: HTMLDialogElement | undefined = $state()
  proposing = $state(false)
  problem = $state<string | null>(null)
  readonly #here: () => { page: string; id: string }
  readonly #gathered: () => void

  // `here` names the settings page open, whose settings' changes are put
  // under its name; `gathered` hears a change put, as the sidebar opens.
  constructor(here: () => { page: string; id: string }, gathered: () => void = () => {}) {
    this.#here = here
    this.#gathered = gathered
  }

  get here() {
    return this.#here()
  }

  get count(): number {
    return this.baskets.reduce((n, b) => n + b.changes.length, 0)
  }

  get under(): Basket | null {
    return this.baskets.find((b) => b.circle === this.reviewing) ?? null
  }

  load() {
    try {
      this.baskets = read(document.cookie.match(/(?:^|;\s*)cella-basket=([^;]*)/)?.[1])
    } catch {
      this.baskets = []
    }
  }

  #keep() {
    try {
      document.cookie = this.baskets.length
        ? `cella-basket=${spelt(this.baskets)}; path=/; samesite=lax`
        : 'cella-basket=; path=/; max-age=0; samesite=lax'
    } catch {
      // Without the cookie the basket still gathers; it only empties on a
      // reload.
    }
  }

  // The change waiting to a setting of the page open, if any.
  waiting(field: string): Change | null {
    return waiting(this.baskets, { ...this.#here(), field })
  }

  // A setting's change put in the basket of the circle that decides it,
  // or taken out where it is back to the value in force.
  put(decider: Decider, change: Omit<Change, 'page' | 'id'>) {
    const before = this.count
    this.baskets = put(this.baskets, decider, { ...this.#here(), ...change })
    this.#keep()
    if (this.count > before) {
      this.#gathered()
    }
  }

  remove(circle: string, change: Change) {
    this.baskets = removed(this.baskets, circle, change)
    this.#keep()
  }

  discard(circle: string) {
    this.baskets = removed(this.baskets, circle)
    this.#keep()
  }

  // Opens the dialog proposing a basket as one motion.
  review(circle: string) {
    this.reviewing = circle
    this.problem = null
    this.dialog?.showModal()
  }

  propose(): boolean {
    if (this.proposing) {
      return false
    }
    this.proposing = true
    return true
  }

  // The proposal answered: proposed, the basket is emptied and the dialog
  // closes; refused, the dialog says why and stays open.
  answered(proposed: boolean, reason?: string) {
    this.proposing = false
    if (!proposed) {
      this.problem = reason ?? 'the motion was not proposed'
      return
    }
    if (this.reviewing) {
      this.discard(this.reviewing)
    }
    this.close()
  }

  close() {
    this.dialog?.close()
    this.closed()
  }

  closed() {
    if (!this.dialog?.open) {
      this.reviewing = null
      this.problem = null
    }
  }
}
