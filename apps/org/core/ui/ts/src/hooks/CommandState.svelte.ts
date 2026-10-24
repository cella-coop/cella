import type { Jump } from '../models/view.ts'

// The command menu: what is typed, the items it searches, fetched on the
// first open, and the one the keyboard is on.
export class CommandState {
  query = $state('')
  items: Jump[] = $state.raw([])
  active = $state(0)
  dialog: HTMLDialogElement | undefined = $state()

  readonly #collections: () => Jump[]
  readonly #source: () => string
  #loaded = false

  constructor(collections: () => Jump[], source: () => string) {
    this.#collections = collections
    this.#source = source
  }

  shown = $derived.by(() => {
    const q = this.query.trim().toLowerCase()
    const collections = this.#collections()
    if (!q) {
      return collections
    }
    return [...collections, ...this.items].filter((i) => `${i.title} ${i.sub ?? ''} ${i.kind}`.toLowerCase().includes(q)).slice(0, 40)
  })

  async open() {
    this.query = ''
    this.active = 0
    this.dialog?.showModal()
    if (this.#loaded) {
      return
    }
    // Loaded once; a failed fetch leaves the collections to jump to and is
    // tried again on the next open.
    this.#loaded = true
    try {
      const res = await fetch(this.#source())
      if (!res.ok) {
        throw new Error(`${this.#source()}: ${res.status}`)
      }
      this.items = await res.json()
    } catch {
      this.#loaded = false
    }
  }

  close() {
    this.dialog?.close()
  }

  toggle() {
    if (this.dialog?.open) {
      this.close()
    } else {
      this.open()
    }
  }

  move(by: number) {
    this.active = Math.max(0, Math.min(this.active + by, this.shown.length - 1))
  }

  typed() {
    this.active = 0
  }
}
