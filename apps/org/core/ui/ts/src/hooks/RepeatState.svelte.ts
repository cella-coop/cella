import { added, moved, removed } from '../models/repeat.ts'

// A `Repeat`'s rows, as a form builds them up before it posts: added,
// removed and reordered here, in memory, until the form's write takes
// the whole list at once, as an invoice posts its lines. `make` is the
// row a fresh Add appends; it never commits anything itself. Its moves
// are `models/repeat.ts`'s.
export class RepeatState<T> {
  rows: T[] = $state([])
  readonly #make: () => T

  constructor(make: () => T, rows: T[] = []) {
    this.#make = make
    this.rows = rows
  }

  add() {
    this.rows = added(this.rows, this.#make)
  }

  remove(i: number) {
    this.rows = removed(this.rows, i)
  }

  move(from: number, to: number) {
    this.rows = moved(this.rows, from, to)
  }
}
