import { nearer, spoken, warns } from '../models/countdown.ts'

// A visitor's copy of the demo, and its room's lifetime once it runs:
// `idle` resets the copy with no request for that long, counted again at
// each page and at each touch or key the visitor gives it, which nearly
// always asks the server something; `ends`, when the room's lifetime
// ends however busy, in seconds since 1970, 0 before its first member
// signs in. The strip shows no countdown with neither pressing: the idle
// span alone, far off, says nothing worth watching, and the lifetime has
// not started. Once it has, the lifetime counts down; the idle span
// stays quiet until its last two minutes, when it warns instead, taking
// the strip over, since by then it is the sooner of the two (`warns` and
// `nearer`, `../models/countdown.ts`). It runs in the browser alone, once
// attached; the server renders the whole span.
export class CountdownState {
  readonly #idle: () => number
  readonly #ends: () => number
  #since = $state(0)
  #now = $state(0)

  constructor(idle: () => number, ends: () => number) {
    this.#idle = idle
    this.#ends = ends
  }

  // Seconds left of this browser's own idle span; Infinity where none
  // runs (no copy).
  get idleLeft(): number {
    if (!this.#idle()) {
      return Infinity
    }
    const now = this.#now || Date.now()
    const gone = this.#since ? (now - this.#since) / 1000 : 0
    return Math.max(0, this.#idle() - gone)
  }

  // Seconds left of the room's lifetime; null before it starts.
  get lifeLeft(): number | null {
    if (!this.#ends()) {
      return null
    }
    const now = this.#now || Date.now()
    return Math.max(0, this.#ends() - now / 1000)
  }

  // The idle reset is close enough to warn about, its last two minutes,
  // and nearer than the lifetime's own end: a lifetime ending sooner
  // keeps its plain style.
  get warn(): boolean {
    return warns(this.idleLeft, this.lifeLeft)
  }

  // Whether the strip has a countdown to show at all.
  get active(): boolean {
    return this.warn || this.lifeLeft !== null
  }

  // What is left, as `1:59:30`: the sooner of the idle reset and the
  // lifetime's end.
  get left(): string {
    return spoken(nearer(this.idleLeft, this.lifeLeft))
  }

  // The idle span, said in words: `2 hours`, `90 minutes`.
  get span(): string {
    const h = this.#idle() / 3600
    if (Number.isInteger(h)) {
      return h === 1 ? '1 hour' : `${h} hours`
    }
    const m = Math.round(this.#idle() / 60)
    return m === 1 ? '1 minute' : `${m} minutes`
  }

  // Attached to the banner: a tick each second, and the idle span started
  // again by the visitor's touch or key.
  run = (node: HTMLElement) => {
    const again = () => {
      this.#since = Date.now()
      this.#now = this.#since
    }
    again()
    const window = node.ownerDocument.defaultView
    const tick = setInterval(() => {
      this.#now = Date.now()
    }, 1000)
    window?.addEventListener('pointerdown', again)
    window?.addEventListener('keydown', again)
    return () => {
      clearInterval(tick)
      window?.removeEventListener('pointerdown', again)
      window?.removeEventListener('keydown', again)
    }
  }
}
