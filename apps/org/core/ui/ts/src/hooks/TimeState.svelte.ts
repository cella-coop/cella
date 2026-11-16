import { isTime, nearest, parsedTime, reached, timePattern, times } from '../models/time.ts'

// A time field's state: what is typed, until a pick from its list
// replaces it, its complaint, and the `HH:MM` the field posts; and its
// list's, whether it is open, the time the keyboard is on (the listbox's
// active descendant) and the figures typed in a run, which reach the time
// they start. Its moves are `models/time.ts`'s.
export class TimeState {
  // What is typed; before anything is, the value's own time.
  #draft: string | null = $state(null)
  complaint = $state('')
  open = $state(false)
  active = $state(-1)
  readonly list: string[]
  #typed = ''
  #quiet: ReturnType<typeof setTimeout> | undefined
  readonly #value: () => string | number
  readonly #set: (time: string) => void
  readonly #first: string

  constructor(value: () => string | number, set: (time: string) => void, step = 15) {
    this.#value = value
    this.#set = set
    this.list = times(step)
    this.#first = this.time
  }

  // The `HH:MM` the field holds, or ''.
  get time(): string {
    const v = String(this.#value() ?? '').slice(0, 5)
    return isTime(v) ? v : ''
  }

  // What the field shows: what is typed, else its time.
  get shown(): string {
    return this.#draft ?? this.time
  }

  // Takes what is typed; keeps why it names no time, or nothing.
  type(text: string) {
    this.#draft = text
    const t = parsedTime(text)
    this.#set(t ?? '')
    this.complaint = text.trim() && !t ? `Write the time as ${timePattern}, such as 09:30.` : ''
  }

  // Leaving the field writes what it typed as its time: 930 reads 09:30.
  settle() {
    if (this.#draft !== null && !this.complaint) {
      this.#draft = null
    }
  }

  pick(time: string) {
    if (isTime(time)) {
      this.#set(time)
      this.#draft = null
      this.complaint = ''
    }
  }

  // Its form reset: back to the time it was drawn with.
  reset() {
    this.#set(this.#first)
    this.#draft = null
    this.complaint = ''
  }

  // The list opens on the field's time, else the one before it, else nine.
  start() {
    this.active = nearest(this.list, this.time)
    this.open = true
  }

  close() {
    this.open = false
    this.#typed = ''
  }

  move(by: number) {
    this.active = Math.min(this.list.length - 1, Math.max(0, this.active + by))
  }

  to(which: 'first' | 'last') {
    this.active = which === 'first' ? 0 : this.list.length - 1
  }

  hover(at: number) {
    this.active = at
  }

  // A figure typed: the run so far reaches its time; a pause of most of a
  // second starts a new run.
  figure(key: string) {
    clearTimeout(this.#quiet)
    this.#typed += key
    this.#quiet = setTimeout(() => (this.#typed = ''), 800)
    const at = reached(this.list, this.#typed)
    if (at >= 0) {
      this.active = at
    }
  }
}
