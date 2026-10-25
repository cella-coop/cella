import type { Column } from '../models/view.ts'

// How many rows a list, a table or a gallery draws before it asks to show
// more.
export const PAGE = 100

// What a collection's page holds while it is looked at: the filter, the
// row the keyboard is on, how many rows are drawn and whether the New form
// is open. Rows and columns are read through getters, so they follow the
// page's data.
export class CollectionState {
  filter = $state('')
  // The keyboard's row, back to none whenever the filter changes the rows
  // it would index.
  active = $derived.by(() => {
    void this.filter
    return -1
  })
  // How many of the shown rows are drawn, back to a page whenever the
  // filter changes them.
  limit = $derived.by(() => {
    void this.filter
    return PAGE
  })
  creating = $state(false)
  search: HTMLInputElement | undefined = $state()

  readonly #rows: () => any[]
  readonly #columns: () => Column[]

  // `q`, the text filter the page opened with, as a view's address holds.
  constructor(rows: () => any[], columns: () => Column[], q: () => string = () => '') {
    this.#rows = rows
    this.#columns = columns
    this.filter = q()
  }

  shown = $derived.by(() => {
    const q = this.filter.trim().toLowerCase()
    const rows = this.#rows()
    if (!q) {
      return rows
    }
    return rows.filter((r) => this.#columns().some((c) => String(c.value(r) ?? '').toLowerCase().includes(q)))
  })

  // The drawn rows, and how many are left undrawn.
  paged = $derived(this.shown.slice(0, this.limit))
  left = $derived(this.shown.length - this.paged.length)

  extend() {
    this.limit += PAGE
  }

  // The keyboard moving past the last drawn row draws the next page.
  move(by: number) {
    const to = Math.max(0, Math.min(this.active + by, this.shown.length - 1))
    if (to >= this.limit) {
      this.extend()
    }
    this.active = to
  }

  toggle() {
    this.creating = !this.creating
  }

  clear() {
    this.filter = ''
    this.search?.blur()
  }

  focus() {
    this.search?.focus()
  }

  // From the filter into the rows.
  enter() {
    this.active = 0
    this.search?.blur()
  }
}
