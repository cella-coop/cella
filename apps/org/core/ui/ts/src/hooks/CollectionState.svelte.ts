import { SvelteSet } from 'svelte/reactivity'
import { step, stop } from '../models/keys.ts'

// What a collection's page holds while it is looked at: the text filter
// as typed and the row the keyboard is on; whether New is open is its
// dialog's, `CreateState`.
// The rows are the server's: the page of them the address asks for, kept
// by the view and its filter in SQL. A filter typed goes into the address
// once the typing pauses, and "Show more" asks for the next page there, so
// the server reads the rows again; rows and what is left are read through
// getters, so they follow the page's data.
export class CollectionState {
  #filter = $state('')
  // The keyboard's row, back to none whenever the filter changes the rows
  // it would index.
  active = $derived.by(() => {
    void this.#filter
    return -1
  })
  // The field the filter bar adds a condition on, while its popover picks
  // the first value it keeps.
  adding: string | null = $state(null)
  // The filter bar's search: expanded to its input, which a blur or
  // Escape collapses back, to its chip once it holds text, else to the
  // magnifier alone.
  searching = $state(false)
  search: HTMLInputElement | undefined = $state()
  // The filter bar's + Filter, wherever it is mounted, header or bar, so
  // "F" opens it as a click would.
  adder: HTMLButtonElement | undefined = $state()
  // The groups the viewer collapsed, by value; a reload opens them
  // again, as a view the address alone draws has no viewer to keep it
  // for. `SvelteSet`, so adding or deleting a value is itself seen,
  // which a plain `Set` under `$state` is not.
  collapsed: SvelteSet<string> = new SvelteSet()

  readonly #rows: () => any[]
  readonly #left: () => number
  readonly #ask: { filter(q: string): void; more(): void }
  #typing: ReturnType<typeof setTimeout> | undefined

  // `q`, the text filter the page opened with, as a view's address holds;
  // `ask` takes a filter or a next page to the address.
  constructor(rows: () => any[], left: () => number, q: () => string, ask: { filter(q: string): void; more(): void }) {
    this.#rows = rows
    this.#left = left
    this.#ask = ask
    this.#filter = q()
  }

  get filter() {
    return this.#filter
  }

  set filter(q: string) {
    this.#filter = q
    clearTimeout(this.#typing)
    this.#typing = setTimeout(() => this.#ask.filter(q), 250)
  }

  get shown() {
    return this.#rows()
  }

  get left() {
    return this.#left()
  }

  extend() {
    this.#ask.more()
  }

  // The keyboard moving past the last drawn row asks for the next page
  // once, and is on its first row, which takes the focus once it is drawn.
  move(by: number) {
    const to = step(this.active, by, this.shown.length, this.left)
    if (to >= this.shown.length && this.active < this.shown.length) {
      this.extend()
    }
    this.active = to
  }

  // The row in the tab order.
  get stop() {
    return stop(this.active, this.shown.length)
  }

  clear() {
    this.filter = ''
    this.search?.blur()
  }

  focus() {
    this.search?.focus()
  }

  // "F": opens + Filter's list of fields, as a click on it would.
  openAdd() {
    this.adder?.focus()
    this.adder?.click()
  }

  // From the filter into the rows.
  enter() {
    this.active = 0
    this.search?.blur()
  }

  // A group's bar's chevron: its rows show or hide, the other groups'
  // kept as they are.
  toggleGroup(value: string) {
    if (this.collapsed.has(value)) {
      this.collapsed.delete(value)
    } else {
      this.collapsed.add(value)
    }
  }
}
