import { dayPattern, parsed, typed } from '../models/format.ts'
import { isDay, monthed, shifted, weekEdge } from '../models/calendar.ts'

// A date field's state: what is typed, until a pick from its calendar
// replaces it, its complaint, and the ISO day the field posts; and its
// calendar's, the day the keyboard is on, whose month it shows.
export class DateState {
  // What is typed; before anything is, the value's own day.
  #draft: string | null = $state(null)
  complaint = $state('')
  // The day the calendar's keyboard is on, an ISO day.
  at = $state('')
  // Today, as the browser reads it when the calendar opens.
  today = $state('')
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

  // The ISO day the field holds, or ''.
  get day(): string {
    const v = String(this.#value() ?? '').slice(0, 10)
    return isDay(v) ? v : ''
  }

  // Takes what is typed; keeps why it names no day, or nothing.
  type(text: string) {
    this.#draft = text
    const day = parsed(text)
    this.#set(day ?? '')
    this.complaint = text.trim() && !day ? `Write the day as ${dayPattern}.` : ''
  }

  pick(iso: string) {
    if (iso) {
      this.#set(iso)
      this.#draft = null
      this.complaint = ''
    }
  }

  // The calendar opens on the field's day, else today.
  open(today: string) {
    this.today = today
    this.at = this.day || today
  }

  // The keyboard's moves: by days, by months, to a week's ends.
  step(n: number) {
    this.at = shifted(this.at, n)
  }

  month(n: number) {
    this.at = monthed(this.at, n)
  }

  edge(which: 'start' | 'end') {
    this.at = weekEdge(this.at, which)
  }
}
