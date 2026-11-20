import { onMount } from 'svelte'
import { saved, writable, type Custom, type Layout, type Saved, type Spec } from '../models/query.ts'
import { reorder } from '../models/drag.ts'
import type { PinnedState } from './PinnedState.svelte.ts'
import { usePinned } from './usePinned.ts'

const key = 'cella-views'

// The viewer's own views of one collection: preferences kept in their
// browser, never records of the coop's, so they go through no write and
// no log. Read once the page is in the browser, as the server cannot; the
// store is versioned to move into a member's preferences as it is. How
// many rows each keeps is asked of the server, which renders the page
// without them, once they are read and again whenever the rows change.
// A view pinned under Pinned follows it: renamed, changed or deleted, so
// is its pin, at the address `href` gives it. A view saved in a layout
// no longer drawn opens in the collection's own, `layout`.
export class ViewsState {
  list: Custom[] = $state([])
  tallies: Record<string, number> = $state({})
  // The view renamed in place on its chip, the name it holds, and the
  // chip the focus goes back to once the keyboard ends it.
  renaming: string | null = $state(null)
  draft = $state('')
  back: string | null = $state(null)
  readonly #collection: () => string
  readonly #href: (view: Custom) => string
  readonly #layout: () => Layout
  readonly #pinned: PinnedState

  // `rows` is anything that changes when the rows do, such as how many
  // the view keeps. Another collection is another component, and so
  // another state, so the views are read once, as it mounts.
  constructor(collection: () => string, rows: () => unknown = () => null, href: (view: Custom) => string = (c) => `/${collection()}?v=${c.id}`, layout: () => Layout = () => 'list') {
    this.#collection = collection
    this.#href = href
    this.#layout = layout
    this.#pinned = usePinned()
    onMount(() => {
      this.list = this.#read().views[this.#collection()] ?? []
    })
    $effect(() => {
      void rows()
      this.#tally(this.#collection(), $state.snapshot(this.list))
    })
  }

  // Each view's count, from the collection's JSON read: one request for
  // all, each through the lens or, where it reads across circles, whole.
  async #tally(collection: string, list: Custom[]) {
    if (!list.length) {
      return
    }
    const where = encodeURIComponent(JSON.stringify(list.map((c) => c.spec.where)))
    const across = encodeURIComponent(JSON.stringify(list.map((c) => c.spec.across)))
    const answer = await fetch(`/${encodeURIComponent(collection)}?where=${where}&across=${across}`, { headers: { accept: 'application/json' } }).catch(() => null)
    const counts: unknown = answer?.ok ? await answer.json() : null
    if (Array.isArray(counts) && collection === this.#collection()) {
      this.tallies = Object.fromEntries(list.flatMap((c, i) => (typeof counts[i] === 'number' ? [[c.id, counts[i]]] : [])))
    }
  }

  #read(): Saved {
    try {
      return saved(JSON.parse(localStorage.getItem(key) ?? 'null'), (c) => (c === this.#collection() ? this.#layout() : 'list'))
    } catch {
      return saved(null)
    }
  }

  #write() {
    try {
      const store = writable(JSON.parse(localStorage.getItem(key) ?? 'null'))
      store.views[this.#collection()] = $state.snapshot(this.list)
      localStorage.setItem(key, JSON.stringify(store))
    } catch {
      // Without storage the views last until the page is left.
    }
    const collection = this.#collection()
    this.#pinned.follow(
      collection,
      this.list.map((c) => ({ collection, view: c.id, name: c.name, ...(c.icon ? { icon: c.icon } : {}), href: this.#href(c) })),
    )
  }

  find(id: string) {
    return this.list.find((c) => c.id === id)
  }

  save(spec: Spec): Custom {
    // Named on its chip as it is made (`begin`), its icon its menu's.
    const view = { id: `c-${Date.now().toString(36)}`, name: 'Untitled view', icon: 'bookmark', spec }
    this.list = [...this.list, view]
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

  // Renaming on the chip: begun from its menu, the chip an input holding
  // the name; kept on Enter or as it loses the focus, dropped on Escape.
  begin(id: string) {
    this.draft = this.find(id)?.name ?? ''
    this.renaming = id
  }

  // Ends the renaming, keeping the name or not; `back`, by the keyboard,
  // so the focus goes back to its chip.
  commit(back = false) {
    if (this.renaming) {
      this.rename(this.renaming, this.draft)
      this.back = back ? this.renaming : null
    }
    this.renaming = null
  }

  cancel() {
    this.back = this.renaming
    this.renaming = null
  }

  // The icon a view wears in its tab and under Pinned.
  mark(id: string, icon: string) {
    this.list = this.list.map((c) => (c.id === id ? { ...c, icon } : c))
    this.#write()
  }

  // A copy of a view, the viewer's own or a preset's, as one of theirs
  // just after the one it copies, or last for a preset's.
  duplicate(from: { id: string; name: string; icon?: string; spec: Spec }): Custom {
    const view = { id: `c-${Date.now().toString(36)}`, name: `${from.name} copy`, ...(from.icon ? { icon: from.icon } : {}), spec: $state.snapshot(from.spec) as Spec }
    const at = this.list.findIndex((c) => c.id === from.id)
    this.list = at >= 0 ? [...this.list.slice(0, at + 1), view, ...this.list.slice(at + 1)] : [...this.list, view]
    this.#write()
    return view
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
