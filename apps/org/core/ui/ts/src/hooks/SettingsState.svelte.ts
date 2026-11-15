import { direct, offer, type Decider, type Proposal, type Setting } from '../models/settings.ts'
import { took, type Answer } from '../post.ts'

// What a field's quiet line says of its last write: under way, saved, or
// refused, with the reason its outcome gives.
export type Note = { state: 'saving' } | { state: 'saved' } | { state: 'refused'; reason: string }

// A settings form while it is read and changed: what was typed in each
// field, by name, the rest showing the value in force, so a field saved
// follows the page's data; each field's last write, and the value it
// posted; the fields left unsaved, marked so, those a motion is about
// until it is proposed; and the motion offered instead, in its dialog
// while it is open. Each field saves on its own as it is left, by the
// form's `post`, one write after another.
export class SettingsState {
  typed = $state<Record<string, string>>({})
  unsaved = $state<string[]>([])
  notes = $state<Record<string, Note>>({})
  offered = $state<Proposal | null>(null)
  // The dialog offering the motion, whether its proposal is posting, and
  // why it was not proposed, as its refusal says.
  dialog: HTMLDialogElement | undefined = $state()
  proposing = $state(false)
  problem = $state<string | null>(null)
  readonly #settings: () => Setting[]
  readonly #decider: () => Decider | null
  readonly #post: (write: string, fields: [string, string][]) => Promise<Answer>
  #sent: Record<string, string> = {}
  // The field whose leave opened the dialog, and, where focus went back
  // to it as the dialog closed, it with its value then.
  #left: string | null = null
  #dismissed: { name: string; value: string } | null = null
  #writing: Promise<void> = Promise.resolve()

  constructor(settings: () => Setting[], decider: () => Decider | null, post: (write: string, fields: [string, string][]) => Promise<Answer>) {
    this.#settings = settings
    this.#decider = decider
    this.#post = post
  }

  get decider(): Decider | null {
    return this.#decider()
  }

  value(s: Setting): string {
    return this.typed[s.name] ?? s.value
  }

  // A value typed: what was said of the last one goes, and it is marked
  // not saved only once it is left again.
  type(s: Setting, value: string) {
    this.typed[s.name] = value
    this.unsaved = this.unsaved.filter((n) => n !== s.name)
    delete this.notes[s.name]
  }

  // A field left: changed, its reader's write saves it, once for each
  // value, so one refused or lost posts again only once changed; or it is
  // marked not saved and the motion that changes it is offered, while no
  // dialog is open already, and but for the leave that follows the
  // dialog's closing, focus gone back to the field, unchanged.
  leave(s: Setting) {
    const value = this.typed[s.name]
    if (value === undefined || value === s.value) {
      delete this.typed[s.name]
      return
    }
    if (direct(s)) {
      if (this.#sent[s.name] !== value) {
        this.#sent[s.name] = value
        this.#writing = this.#writing.then(() => this.#save(s, value)).catch(() => undefined)
      }
      return
    }
    this.#mark(s.name)
    const dismissed = this.#dismissed?.name === s.name && this.#dismissed.value === value
    this.#dismissed = null
    if (this.dialog?.open || dismissed) {
      return
    }
    this.#left = s.name
    this.offered = offer(this.#settings(), this.typed, this.#decider(), s)
    this.problem = null
    if (this.offered) {
      this.dialog?.showModal()
    }
  }

  // Posts a field's write: settled, it follows the page's data again,
  // unless something else was typed since; refused, the value typed
  // stays, marked not saved, under the reason its outcome gives.
  async #save(s: Setting, value: string) {
    this.notes[s.name] = { state: 'saving' }
    let answer: Answer | null = null
    try {
      answer = await this.#post(s.write!, [[s.name, value]])
    } finally {
      const changed = this.typed[s.name] !== value
      if (answer && took(answer)) {
        if (!changed) {
          delete this.typed[s.name]
          this.notes[s.name] = { state: 'saved' }
        }
      } else {
        if (!changed) {
          const reason = answer && 'done' in answer ? answer.done?.reason : undefined
          this.notes[s.name] = { state: 'refused', reason: reason ?? 'it was not saved' }
          this.#mark(s.name)
        }
      }
    }
  }

  #mark(name: string) {
    if (!this.unsaved.includes(name)) {
      this.unsaved = [...this.unsaved, name]
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

  // The proposal answered: proposed, its fields show the values in force
  // again, the change now the motion's to make; refused, the dialog says
  // why and stays open.
  answered(proposed: boolean, reason?: string) {
    this.proposing = false
    if (!proposed) {
      this.problem = reason ?? 'the motion was not proposed'
      return
    }
    const fields = this.offered?.fields ?? []
    for (const name of fields) {
      delete this.typed[name]
    }
    this.unsaved = this.unsaved.filter((n) => !fields.includes(n))
    this.close()
  }

  close() {
    this.dialog?.close()
  }

  // The dialog closed, by its button, Escape or a click outside it: what
  // was typed stays, marked not saved. A close heard once the dialog is
  // open again is a stale one, as Chromium may deliver Escape's after the
  // next field left opened it, and changes nothing.
  dismiss() {
    if (this.dialog?.open) {
      return
    }
    const left = this.#left
    const back = left !== null && left in this.typed && (document.activeElement as { name?: string } | null)?.name === left
    this.#dismissed = back ? { name: left, value: this.typed[left] } : null
    this.#left = null
    this.offered = null
    this.problem = null
  }
}
