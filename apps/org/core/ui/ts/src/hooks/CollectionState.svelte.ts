// What a collection's page holds while it is looked at: the text filter
// as typed, the row the keyboard is on, and whether the New form is open.
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
  creating = $state(false)
  search: HTMLInputElement | undefined = $state()

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

  // The keyboard moving past the last drawn row asks for the next page.
  move(by: number) {
    const to = Math.max(0, Math.min(this.active + by, this.shown.length - 1 + (this.left > 0 ? 1 : 0)))
    if (to >= this.shown.length) {
      this.extend()
    }
    this.active = Math.min(to, this.shown.length - 1)
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
