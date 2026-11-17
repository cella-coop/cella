import type { Message } from '../models/thread.ts'

// A deliberation's reply being written: the message it answers, chosen
// from the thread, until it is posted, when the thread has grown, or
// dropped, when it answers its conversation's root.
export class ThreadState {
  #reply = $state<{ to: number; at: number } | null>(null)
  readonly #messages: () => Message[]

  constructor(messages: () => Message[]) {
    this.#messages = messages
  }

  get reply(): number | null {
    return this.#reply && this.#reply.at === this.#messages().length ? this.#reply.to : null
  }

  answering = $derived.by(() => this.#messages().find((m) => m.receipt === this.reply) ?? null)

  // A message answered: the focus in the box at its conversation's foot.
  answer(to: number, root: number) {
    this.#reply = { to, at: this.#messages().length }
    document.querySelector<HTMLElement>(`[data-thread="${root}"] [data-rich]`)?.focus()
  }

  drop() {
    this.#reply = null
  }
}
