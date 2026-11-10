import { onMount } from 'svelte'
import { saved, type Custom, type Saved, type Spec } from '../models/query.ts'
import { reorder } from '../models/drag.ts'

const key = 'cella-views'

// The viewer's own views of one collection: preferences kept in their
// browser, never records of the co-op's, so they go through no write and
// no log. Read once the page is in the browser, as the server cannot; the
// store is versioned to move into a member's preferences as it is. How
// many rows each keeps is asked of the server, which renders the page
// without them, once they are read and again whenever the rows change.
export class ViewsState {
  list: Custom[] = $state([])
  tallies: Record<string, number> = $state({})
  // The View panel's save form: open, and the name and icon it holds.
  naming = $state(false)
  name = $state('')
  icon = $state('bookmark')
  readonly #collection: () => string

  // `rows` is anything that changes when the rows do, such as how many
  // the view keeps. Another collection is another component, and so
  // another state, so the views are read once, as it mounts.
  constructor(collection: () => string, rows: () => unknown = () => null) {
    this.#collection = collection
    onMount(() => {
      this.list = this.#read().views[this.#collection()] ?? []
    })
    $effect(() => {
      void rows()
      this.#tally(this.#collection(), $state.snapshot(this.list))
    })
  }

  // Each view's count, from the collection's JSON read: one request for all.
  async #tally(collection: string, list: Custom[]) {
    if (!list.length) {
      return
    }
    const where = encodeURIComponent(JSON.stringify(list.map((c) => c.spec.where)))
    const answer = await fetch(`/${encodeURIComponent(collection)}?where=${where}`, { headers: { accept: 'application/json' } }).catch(() => null)
    const counts: unknown = answer?.ok ? await answer.json() : null
    if (Array.isArray(counts) && collection === this.#collection()) {
      this.tallies = Object.fromEntries(list.flatMap((c, i) => (typeof counts[i] === 'number' ? [[c.id, counts[i]]] : [])))
    }
  }

  #read(): Saved {
    try {
      return saved(JSON.parse(localStorage.getItem(key) ?? 'null'))
    } catch {
      return saved(null)
    }
  }

  #write() {
    try {
      const store = this.#read()
      store.views[this.#collection()] = $state.snapshot(this.list)
      localStorage.setItem(key, JSON.stringify(store))
    } catch {
      // Without storage the views last until the page is left.
    }
  }

  find(id: string) {
    return this.list.find((c) => c.id === id)
  }

  save(spec: Spec): Custom {
    const view = { id: `c-${Date.now().toString(36)}`, name: this.name.trim() || 'Untitled view', icon: this.icon, spec }
    this.list = [...this.list, view]
    this.naming = false
    this.name = ''
    this.#write()
    return view
  }

  update(id: string, spec: Spec) {
    this.list = this.list.map((c) => (c.id === id ? { ...c, spec } : c))
    this.#write()
  }

  rename(id: string, name: string) {
    if (!name.trim()) {
      return
    }
    this.list = this.list.map((c) => (c.id === id ? { ...c, name: name.trim() } : c))
    this.#write()
  }

  remove(id: string) {
    this.list = this.list.filter((c) => c.id !== id)
    this.#write()
  }

  arrange(from: number, to: number) {
    this.list = reorder(this.list, from, to)
    this.#write()
  }
}
