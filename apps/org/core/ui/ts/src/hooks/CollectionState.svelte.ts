import type { Column } from '../models/view.ts'

// What a collection's page holds while it is looked at: the filter, the
// row the keyboard is on and whether the New form is open. Rows and
// columns are read through getters, so they follow the page's data.
export class CollectionState {
  filter = $state('')
  // The keyboard's row, back to none whenever the filter changes the rows
  // it would index.
  active = $derived.by(() => {
    void this.filter
    return -1
  })
  creating = $state(false)
  search: HTMLInputElement | undefined = $state()

  readonly #rows: () => any[]
  readonly #columns: () => Column[]

  constructor(rows: () => any[], columns: () => Column[]) {
    this.#rows = rows
    this.#columns = columns
  }

  shown = $derived.by(() => {
    const q = this.filter.trim().toLowerCase()
    const rows = this.#rows()
    if (!q) {
      return rows
    }
    return rows.filter((r) => this.#columns().some((c) => String(c.value(r) ?? '').toLowerCase().includes(q)))
  })

  move(by: number) {
    this.active = Math.max(0, Math.min(this.active + by, this.shown.length - 1))
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
