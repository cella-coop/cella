import { direct, posted, proposal, type Decider, type Proposal, type Setting } from '../models/settings.ts'
import { took, type Answer } from '../post.ts'
import type { WriteState } from './WriteState.svelte.ts'

// How a setting's last commit went, as the mark beside it says it: its
// write under way, saved, proposed as a motion, or not saved and why.
export interface Mark {
  state: 'saving' | 'saved' | 'proposed' | 'refused'
  reason?: string
}

// How long a setting says it was saved or proposed.
const brief = 2500

// A settings form while it is read and changed: what was typed in each
// field, by name, the rest showing the value in force, so a field saved
// follows the page's data; how each setting's last commit went; and the
// motion offered for a change no write of the reader's makes, in its
// dialog while it is open. A setting commits as its field does: the
// reader's own write saves it, one write in flight each, a change made
// meanwhile sent once it settles; a motion's change opens the dialog.
export class SettingsState {
  typed = $state<Record<string, string>>({})
  marks = $state<Record<string, Mark>>({})
  offered = $state<Proposal | null>(null)
  // The dialog offering the motion, whether its proposal is posting, and
  // why it was not proposed, as its refusal says.
  dialog: HTMLDialogElement | undefined = $state()
  proposing = $state(false)
  problem = $state<string | null>(null)
  readonly #settings: () => Setting[]
  readonly #decider: () => Decider | null
  readonly #writes: WriteState
  // The writes in flight, those committed again while in flight, and the
  // marks about to fade, by setting.
  readonly #flying = new Set<string>()
  readonly #again = new Set<string>()
  readonly #fading = new Map<string, ReturnType<typeof setTimeout>>()

  constructor(settings: () => Setting[], decider: () => Decider | null, writes: WriteState) {
    this.#settings = settings
    this.#decider = decider
    this.#writes = writes
  }

  get decider(): Decider | null {
    return this.#decider()
  }

  value(s: Setting): string {
    return this.typed[s.name] ?? s.value
  }

  type(s: Setting, value: string) {
    this.typed[s.name] = value
    if (this.marks[s.name]?.state !== 'saving') {
      this.#mark(s.name, null)
    }
  }

  // Whether a setting's field differs from its value in force.
  changed(s: Setting): boolean {
    return s.name in this.typed && this.typed[s.name] !== s.value
  }

  // A setting's edit committed: saved by the reader's write, or, where
  // only a motion changes it, offered as one; nothing where it is
  // unchanged.
  commit(s: Setting) {
    if (!this.changed(s)) {
      return
    }
    if (direct(s)) {
      void this.#save(s)
      return
    }
    this.#offer(s)
  }

  // A typed edit taken back: the field shows the value in force again.
  revert(s: Setting) {
    delete this.typed[s.name]
    if (this.marks[s.name]?.state !== 'saving') {
      this.#mark(s.name, null)
    }
  }

  // Posts a setting's write with the fields it saves that changed, as
  // typed, unless the write is in flight, which sends it again once it
  // settles. A field whose value stood is the page's again; one typed
  // since keeps what was typed.
  async #save(s: Setting) {
    const write = s.write!
    if (this.#flying.has(write)) {
      this.#again.add(write)
      return
    }
    const sent = posted(this.#settings(), s, (o) => this.value(o))
    const changed = this.#settings().filter((o) => o.name in sent)
    if (!changed.length) {
      return
    }
    this.#flying.add(write)
    for (const o of changed) {
      this.#mark(o.name, { state: 'saving' })
    }
    let answer: Answer | null = null
    try {
      answer = await this.#writes.shown(this.#writes.send(write, Object.entries(sent)))
    } finally {
      this.#flying.delete(write)
      const stood = !!answer && took(answer)
      const reason = answer && 'done' in answer ? answer.done?.reason : undefined
      for (const o of changed) {
        const same = this.typed[o.name] === sent[o.name]
        if (stood && same) {
          delete this.typed[o.name]
        }
        this.#mark(o.name, !same ? null : stood ? { state: 'saved' } : { state: 'refused', reason: reason ?? 'it was not saved' })
      }
    }
    if (this.#again.delete(write)) {
      await this.#save(s)
    }
  }

  // Opens the dialog proposing the motion that makes a setting's change,
  // unless one is open; with none to propose, the change is not saved.
  #offer(s: Setting) {
    if (this.offered) {
      return
    }
    const p = proposal(s, this.typed[s.name], this.#decider())
    if (!p) {
      this.#mark(s.name, { state: 'refused', reason: s.refused ?? 'nothing you may write changes it' })
      return
    }
    this.offered = p
    this.problem = null
    this.dialog?.showModal()
  }

  #mark(name: string, mark: Mark | null) {
    clearTimeout(this.#fading.get(name))
    this.#fading.delete(name)
    if (!mark) {
      delete this.marks[name]
      return
    }
    this.marks[name] = mark
    if (mark.state === 'saved' || mark.state === 'proposed') {
      this.#fading.set(
        name,
        setTimeout(() => {
          this.#fading.delete(name)
          delete this.marks[name]
        }, brief),
      )
    }
  }

  // Starts posting the proposal, or says it is under way.
  propose(): boolean {
    if (this.proposing) {
      return false
    }
    this.proposing = true
    return true
  }

  // The proposal answered: proposed, the dialog closes and the field
  // shows the value in force again, the change now the motion's to make;
  // refused, the dialog says why and stays open.
  answered(proposed: boolean, reason?: string) {
    this.proposing = false
    if (!proposed) {
      this.problem = reason ?? 'the motion was not proposed'
      return
    }
    if (this.offered) {
      this.#mark(this.offered.field, { state: 'proposed' })
    }
    this.close()
  }

  // Closes the dialog, its field showing the value in force at once, not
  // after the dialog's close event.
  close() {
    this.#dismiss()
    this.dialog?.close()
  }

  // The dialog's close event, by Escape as by `close`. The browser may
  // fire it after the dialog opened again for the next change, which it
  // leaves be.
  closed() {
    if (!this.dialog?.open) {
      this.#dismiss()
    }
  }

  // The dialog closed, by Cancel, Escape, a click outside it or a
  // proposal made: the field shows the value in force again.
  #dismiss() {
    if (this.offered) {
      delete this.typed[this.offered.field]
    }
    this.offered = null
    this.problem = null
  }
}
