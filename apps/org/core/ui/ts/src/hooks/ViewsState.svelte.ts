import { saved, type Custom, type Saved, type Spec } from '../models/query.ts'
import { reorder } from '../models/drag.ts'

const key = 'cella-views'

// The viewer's own views of one collection: preferences kept in their
// browser, never records of the co-op's, so they go through no write and
// no log. Read once the page is in the browser, as the server cannot; the
// store is versioned to move into a member's preferences as it is.
export class ViewsState {
  list: Custom[] = $state([])
  // The View card's save form: open, and the name and icon it holds.
  naming = $state(false)
  name = $state('')
  icon = $state('bookmark')
  readonly #collection: () => string

  constructor(collection: () => string) {
    this.#collection = collection
    $effect(() => {
      this.list = this.#read().views[this.#collection()] ?? []
    })
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
