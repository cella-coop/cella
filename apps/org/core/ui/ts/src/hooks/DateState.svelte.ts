import { dayPattern, parsed, typed } from '../models/format.ts'

// A date field's state: what is typed, until a pick from the browser's
// calendar replaces it, and the ISO day it names, which the field posts.
export class DateState {
  // What is typed; before anything is, the value's own day.
  #draft: string | null = $state(null)
  readonly #value: () => string | number
  readonly #set: (iso: string) => void

  constructor(value: () => string | number, set: (iso: string) => void) {
    this.#value = value
    this.#set = set
  }

  // What the field shows, in the app's locale.
  get shown(): string {
    return this.#draft ?? typed(this.#value())
  }

  // Takes what is typed; says why it names no day, or nothing.
  type(text: string): string {
    this.#draft = text
    const day = parsed(text)
    this.#set(day ?? '')
    return text.trim() && !day ? `Write the day as ${dayPattern}.` : ''
  }

  pick(iso: string) {
    if (iso) {
      this.#set(iso)
      this.#draft = null
    }
  }
}
