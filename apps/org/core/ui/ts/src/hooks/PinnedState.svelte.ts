import { onMount } from 'svelte'
import { saved, type Pin, type Saved } from '../models/query.ts'

const key = 'cella-views'

// The views a viewer pinned under Pinned, the one place of the sidebar
// the same in every circle: preferences kept in their browser beside
// their own views, never records of the coop's. Read once the page is
// in the browser, as the server cannot; each change is read from the
// store and written back to it at once, so a collection's views and the
// pins never write over each other.
export class PinnedState {
  list: Pin[] = $state([])

  constructor() {
    onMount(() => {
      this.list = this.#read().pins
    })
  }

  #read(): Saved {
    try {
      return saved(JSON.parse(localStorage.getItem(key) ?? 'null'))
    } catch {
      return saved(null)
    }
  }

  // Changes the pins as `change` says, from what the store holds now.
  #change(change: (pins: Pin[]) => Pin[]) {
    const store = this.#read()
    store.pins = change(store.pins)
    this.list = store.pins
    try {
      localStorage.setItem(key, JSON.stringify(store))
    } catch {
      // Without storage the pins last until the page is left.
    }
  }

  pinned(collection: string, view: string): boolean {
    return this.list.some((p) => p.collection === collection && p.view === view)
  }

  // Pins a view last, or moves its pin's name and address to what it is.
  pin(pin: Pin) {
    this.#change((pins) => (pins.some((p) => same(p, pin)) ? pins.map((p) => (same(p, pin) ? pin : p)) : [...pins, pin]))
  }

  unpin(collection: string, view: string) {
    this.#change((pins) => pins.filter((p) => !same(p, { collection, view })))
  }

  // Keeps the pins of a collection's own views with those views: a
  // renamed or changed one's pin takes its name and address, and a
  // deleted one's goes. A preset's pin is left as it is.
  follow(collection: string, views: Pin[]) {
    const own = (p: Pin) => p.collection === collection && p.view.startsWith('c-')
    if (!this.#read().pins.some(own)) {
      return
    }
    this.#change((pins) => pins.flatMap((p) => (own(p) ? views.filter((v) => same(v, p)) : [p])))
  }
}

const same = (a: { collection: string; view: string }, b: { collection: string; view: string }) => a.collection === b.collection && a.view === b.view
