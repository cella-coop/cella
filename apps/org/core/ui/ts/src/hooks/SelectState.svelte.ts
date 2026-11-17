import { edge, indexOf, moved, typedTo, type Option } from '../models/select.ts'

// A select's state: whether its list is open, the option the keyboard is
// on (the combobox's active descendant), and the letters typed in a run,
// which reach the option they start. Its moves are `models/select.ts`'s.
export class SelectState {
  open = $state(false)
  // Counts the closings, which a picker's search is drawn anew by, so it
  // opens empty.
  turn = $state(0)
  active = $state(-1)
  #typed = ''
  #quiet: ReturnType<typeof setTimeout> | undefined
  readonly #options: () => Option[]
  readonly #value: () => string

  constructor(options: () => Option[], value: () => string) {
    this.#options = options
    this.#value = value
  }

  // Opening starts on the chosen option, else the first that may be.
  start(at?: 'first' | 'last') {
    const options = this.#options()
    const chosen = indexOf(options, this.#value())
    this.active = at ? edge(options, at) : chosen >= 0 && !options[chosen].disabled ? chosen : edge(options, 'first')
    this.open = true
  }

  close() {
    this.open = false
    this.turn++
    this.#typed = ''
  }

  move(by: number) {
    this.active = moved(this.#options(), this.active, by)
  }

  to(which: 'first' | 'last') {
    this.active = edge(this.#options(), which)
  }

  hover(at: number) {
    if (!this.#options()[at]?.disabled) {
      this.active = at
    }
  }

  // A letter typed: the run so far reaches its option; a pause of half a
  // second starts a new run.
  type(key: string) {
    clearTimeout(this.#quiet)
    this.#typed += key
    this.#quiet = setTimeout(() => (this.#typed = ''), 500)
    this.active = typedTo(this.#options(), this.active, this.#typed)
  }

  // Whether a run of typing is under way, so a space extends it rather
  // than choosing.
  get typing(): boolean {
    return this.#typed.length > 0
  }
}
