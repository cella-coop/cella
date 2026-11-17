import type { Suggestion, Trigger } from '@cella/org-ui'
import type { Named } from '../models/thread.ts'

// A record's threads while a comment is written: who the mention picker
// may offer, and the way to a thread's reply. Who may be offered is
// edit-time data: `load` fetches it once, in the browser, never awaited at
// SSR with the record itself. What is typed is each box's own.
export class ThreadsState {
  readonly #fetch: () => Promise<Named[]>
  #loaded = false
  #readers = $state<Named[]>([])

  constructor(readers: () => Promise<Named[]>) {
    this.#fetch = readers
  }

  // Fetches who the mention picker may offer, once; called as the box
  // mounts. A failed fetch is tried again a few seconds later, up to
  // three times, so a passing error leaves no box without mentions.
  load(tries = 3): void {
    if (this.#loaded) {
      return
    }
    this.#loaded = true
    this.#fetch()
      .then((r) => (this.#readers = r))
      .catch((e) => {
        console.warn('mention readers failed to load', e)
        this.#loaded = false
        if (tries > 1) {
          setTimeout(() => this.load(tries - 1), 3000)
        }
      })
  }

  // A thread's Reply: the focus in the box at its foot.
  answer(root: number) {
    document.querySelector<HTMLElement>(`[data-thread="${root}"] [data-rich]`)?.focus()
  }

  // The people the picker offers for the `@` being typed: those who may
  // read the record whose name or address holds what follows it, each
  // put in as their `@[address]`.
  suggest = (trigger: Trigger, query: string): Suggestion[] => {
    if (trigger !== '@') {
      return []
    }
    const want = query.toLowerCase()
    return this.#readers
      .filter((r) => r.name && (r.name.toLowerCase().includes(want) || r.person.startsWith(want)))
      .map((r) => ({ label: r.name!, token: `@[${r.person}]` }))
  }
}
