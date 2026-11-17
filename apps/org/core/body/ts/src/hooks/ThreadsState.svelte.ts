import { asking, composed, type Comment, type Named } from '../models/thread.ts'

// A record's threads while a comment is written: the root a reply
// answers, chosen from its thread, what is typed and the people the
// mention picker picked, all kept until a post grows the threads, when
// the box opens empty again, or dropped. Who the picker may offer is
// edit-time data: `load` fetches it once, in the browser, never awaited
// at SSR with the record itself.
export class ThreadsState {
  readonly #comments: () => Comment[]
  readonly #fetch: () => Promise<Named[]>
  #loaded = false
  #readers = $state<Named[]>([])
  #reply = $state<number | null>(null)
  #typed = $state('')
  #picked = $state<Named[]>([])
  #at = $state(-1)

  constructor(comments: () => Comment[], readers: () => Promise<Named[]>) {
    this.#comments = comments
    this.#fetch = readers
  }

  // Fetches who the mention picker may offer, once; called as the box
  // mounts.
  load(): void {
    if (this.#loaded) {
      return
    }
    this.#loaded = true
    this.#fetch()
      .then((r) => (this.#readers = r))
      .catch(() => {})
  }

  // Whether what is kept was kept since the threads last grew.
  get #current(): boolean {
    return this.#at === this.#comments().length
  }

  #keep() {
    if (!this.#current) {
      this.#reply = null
      this.#typed = ''
      this.#picked = []
      this.#at = this.#comments().length
    }
  }

  get reply(): number | null {
    return this.#current ? this.#reply : null
  }

  answer(root: number) {
    this.#keep()
    this.#reply = root
  }

  drop() {
    this.#reply = null
  }

  get typed(): string {
    return this.#current ? this.#typed : ''
  }

  set typed(value: string) {
    this.#keep()
    this.#typed = value
  }

  // The people the picker offers for the `@` being typed: those who may
  // read the record whose name or address holds what follows it.
  get offered(): Named[] {
    const q = asking(this.typed)
    if (q === null) {
      return []
    }
    const want = q.toLowerCase()
    return this.#readers
      .filter((r) => r.name && (r.name.toLowerCase().includes(want) || r.person.startsWith(want)))
      .slice(0, 6)
  }

  // A person picked: the `@` being typed becomes their `@name`.
  pick(person: Named) {
    const q = asking(this.typed) ?? ''
    this.typed = `${this.typed.slice(0, this.typed.length - q.length)}${person.name} `
    this.#picked = [...this.#picked.filter((p) => p.person !== person.person), person]
  }

  // The comment as the box posts it.
  get posted(): { text: string; mentions: string[] } {
    return composed(this.typed, this.#current ? this.#picked : [])
  }
}
