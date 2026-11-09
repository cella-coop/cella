// The keyboard's row of a collection's page, kept as the page is left and
// handed back when history returns to it. The page, which mounts with its
// route, captures and restores it by SvelteKit's `snapshot`; its
// Collection, which mounts once its query answers, after history has
// handed the row back, follows it then and takes the row it holds.
export class RowState {
  // The row history handed back before a collection followed it.
  #kept: number | null = null
  #capture: () => number = () => -1
  #restore: ((row: number) => void) | null = null

  capture(): number {
    return this.#capture()
  }

  restore(row: number) {
    if (this.#restore) {
      this.#restore(row)
    } else {
      this.#kept = row
    }
  }

  // A collection's row, read by `get` and set by `set`, which takes the
  // row history kept for it, if any.
  follow(get: () => number, set: (row: number) => void) {
    this.#capture = get
    this.#restore = set
    if (this.#kept !== null) {
      set(this.#kept)
      this.#kept = null
    }
  }
}
