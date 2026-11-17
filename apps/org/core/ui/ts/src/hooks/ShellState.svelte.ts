import type { Component } from 'svelte'
import type { Outcome } from '../models/outcome.ts'
import type { Nav } from '../models/view.ts'
import { recordIcon } from '../record-icons.ts'

// The circle a member lenses the co-op on, from the co-op selector.
export interface Lens {
  id: string
  name: string
  // Its own icon, a slug of the curated set, which a cell, a chip or a
  // group's bar wears in place of the collection's.
  icon?: string | null
}

// An accordion's key as its cookie spells it, a circle's accordion name
// URI-encoded so it holds no `:` or `,`.
const KEY = /^[\w.~!*'()%-]{1,120}$/

// The accordions a cookie holds, as `feature%3AGovernance:1,feature%3AWork:0`:
// an oversized value is ignored, a malformed pair dropped.
function parse(raw: string): Record<string, boolean> {
  const out: Record<string, boolean> = {}
  if (raw.length > 600) {
    return out
  }
  for (const pair of raw.split(',').slice(0, 24)) {
    const [key, flag, ...rest] = pair.split(':')
    if (rest.length === 0 && KEY.test(key) && (flag === '0' || flag === '1')) {
      try {
        out[decodeURIComponent(key)] = flag === '1'
      } catch {
        // A key that is no URI encoding is malformed: dropped.
      }
    }
  }
  return out
}

// The shell's own state: the last write's outcome, until it is dismissed,
// whether the drawer is open and which sidebar accordions the viewer
// opened or shut, which the viewer's cookies keep so the server renders
// the page as they left it, the names of the people the co-op knows, by
// address, which a person's chip shows, the names of the circles the
// member reads, by id, which a circle's column shows, the circle the
// member lensed the co-op on, which the server read from their cookie,
// and the sidebar's navigation, whose collections' icons a record's chip
// wears.
export class ShellState {
  #dismissed: Outcome | null = $state.raw(null)
  readonly #outcome: () => Outcome | null
  readonly #names: () => Record<string, string>
  readonly #lens: () => Lens | null
  readonly #circles: () => Lens[]
  readonly #nav: () => Nav
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
    nav: () => Nav = () => [],
    sections: () => string = () => '',
  ) {
    this.#outcome = outcome
    this.#names = names
    this.#lens = lens
    this.#circles = circles
    this.#nav = nav
    this.drawer = drawer()
    this.toggled = parse(sections())
  }

  // The icon a reference to one of the circles wears: its own, of the
  // curated set, where it has one, else the collection's view declares,
  // by the collection's name; none where it declares none or the shell
  // mounts no such collection. `id` is read only for `circles`, the one
  // collection read everywhere a reference to it is drawn.
  icon(collection: string | undefined, id?: string): Component<any> | undefined {
    if (!collection) {
      return undefined
    }
    const own = collection === 'circles' && id ? recordIcon(this.#circles().find((c) => c.id === id)?.icon) : undefined
    return (
      own ??
      this.#nav()
        .flatMap((g) => g.items)
        .find((i) => i.href === `/${collection}`)?.icon
    )
  }

  // Keeps `left` on the page the viewer is on while it is not a page of
  // settings, each time the viewer arrives on one; called once, as the
  // shell starts, with the router's `after`, so the state class imports no
  // framework of its own.
  follow(path: () => string, away: () => boolean, after: (run: () => void) => void) {
    after(() => {
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
    try {
      const raw = Object.entries(this.toggled).map(([k, v]) => `${encodeURIComponent(k)}:${v ? 1 : 0}`).join(',')
      document.cookie = `cella-sections=${encodeURIComponent(raw)}; path=/; max-age=31536000; samesite=lax`
    } catch {
      // Without the cookie the section still toggles; it only resets on
      // the next page load.
    }
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
