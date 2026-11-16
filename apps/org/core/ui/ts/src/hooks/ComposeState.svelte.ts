import { posted, valued, type Composing } from '../models/compose.ts'
import { took } from '../post.ts'
import type { WriteState } from './WriteState.svelte.ts'

// Something new while it is composed in its dialog: what was typed in
// each field, by name, the rest following what was typed; the dialog,
// whether its proposal is posting, and why it was not proposed, as its
// refusal says. Proposed, the dialog closes empty; refused, it stays open
// saying why, with what was typed.
export class ComposeState {
  typed = $state<Record<string, string>>({})
  dialog: HTMLDialogElement | undefined = $state()
  proposing = $state(false)
  problem = $state<string | null>(null)
  readonly #composing: () => Composing
  readonly #writes: WriteState

  constructor(composing: () => Composing, writes: WriteState) {
    this.#composing = composing
    this.#writes = writes
  }

  get values(): Record<string, string> {
    return valued(this.#composing().fields, this.typed)
  }

  type(name: string, value: string) {
    this.typed[name] = value
  }

  open() {
    this.typed = {}
    this.problem = null
    this.dialog?.showModal()
  }

  close() {
    this.dialog?.close()
  }

  // Posts the motion to the page's `action`, one post at a time.
  async propose(action: string) {
    if (this.proposing) {
      return
    }
    this.proposing = true
    let proposed = false
    let reason: string | undefined
    try {
      const answer = await this.#writes.shown(this.#writes.send(action, posted(this.#composing(), this.values)))
      proposed = took(answer)
      reason = !proposed && 'done' in answer ? answer.done?.reason : undefined
    } finally {
      this.proposing = false
      if (proposed) {
        this.close()
      } else {
        this.problem = reason ?? 'the motion was not proposed'
      }
    }
  }
}
