// A visitor's copy of the demo counting down to its reset: `seconds`
// with no request end it, as does its lifetime's end, whichever comes
// first. The idle count starts again at each page and at each touch or
// key the visitor gives it, which nearly always asks the server
// something. It runs in the browser alone, once attached; the
// server renders the whole span.
export class CountdownState {
  readonly #seconds: () => number
  // When the copy resets however busy, in seconds since 1970; 0, never.
  readonly #ends: () => number
  #since = $state(0)
  #now = $state(0)

  constructor(seconds: () => number, ends: () => number) {
    this.#seconds = seconds
    this.#ends = ends
  }

  get seconds(): number {
    return this.#seconds()
  }

  // What is left, as `1:59:30`; the whole span before it runs.
  get left(): string {
    const gone = this.#since ? Math.floor((this.#now - this.#since) / 1000) : 0
    const now = this.#now || Date.now()
    const life = this.#ends() ? Math.floor(this.#ends() - now / 1000) : Infinity
    const s = Math.max(0, Math.min(this.seconds - gone, life))
    const two = (n: number) => String(n).padStart(2, '0')
    return `${Math.floor(s / 3600)}:${two(Math.floor((s % 3600) / 60))}:${two(s % 60)}`
  }

  // The span, said in words: `2 hours`, `90 minutes`.
  get span(): string {
    const h = this.seconds / 3600
    if (Number.isInteger(h)) {
      return h === 1 ? '1 hour' : `${h} hours`
    }
    const m = Math.round(this.seconds / 60)
    return m === 1 ? '1 minute' : `${m} minutes`
  }

  // Attached to the banner: a tick each second, and the count started
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
