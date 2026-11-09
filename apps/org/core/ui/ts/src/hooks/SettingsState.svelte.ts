import { plan, type Decider, type Plan, type Proposal, type Setting } from '../models/settings.ts'

// A settings form while it is read and changed: what was typed in each
// field, by name, the rest showing the value in force, so a field saved
// follows the page's data; the fields a Save left unsaved, marked so,
// those its motion is about until it is proposed; and the motion offered
// instead, in its dialog while it is open.
export class SettingsState {
  typed = $state<Record<string, string>>({})
  unsaved = $state<string[]>([])
  offered = $state<Proposal | null>(null)
  pending = $state(false)
  // The dialog offering the motion, whether its proposal is posting, and
  // why it was not proposed, as its refusal says.
  dialog: HTMLDialogElement | undefined = $state()
  proposing = $state(false)
  problem = $state<string | null>(null)
  readonly #settings: () => Setting[]
  readonly #decider: () => Decider | null

  constructor(settings: () => Setting[], decider: () => Decider | null) {
    this.#settings = settings
    this.#decider = decider
  }

  get decider(): Decider | null {
    return this.#decider()
  }

  value(s: Setting): string {
    return this.typed[s.name] ?? s.value
  }

  type(s: Setting, value: string) {
    this.typed[s.name] = value
    this.unsaved = this.unsaved.filter((n) => n !== s.name)
  }

  // Whether anything differs from what is in force.
  get changed(): boolean {
    return this.#settings().some((s) => s.name in this.typed && this.typed[s.name] !== s.value)
  }

  // Starts a Save, or says one is under way: its writes and its motion.
  start(): Plan | null {
    if (this.pending) {
      return null
    }
    this.pending = true
    return plan(this.#settings(), this.typed, this.#decider())
  }

  // The writes made: those that settled follow the page's data again;
  // the rest are marked not saved, and the motion is offered once every
  // write settled.
  saved(p: Plan, settled: string[]) {
    const stood = p.saves.filter((s) => settled.includes(s.write))
    for (const name of stood.flatMap((s) => Object.keys(s.fields))) {
      delete this.typed[name]
    }
    this.unsaved = [...p.saves.filter((s) => !stood.includes(s)).flatMap((s) => Object.keys(s.fields)), ...p.left, ...(p.proposal?.fields ?? [])]
    this.offered = stood.length === p.saves.length ? p.proposal : null
    this.problem = null
    this.pending = false
    if (this.offered) {
      this.dialog?.showModal()
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
  // was typed stays, marked not saved.
  dismiss() {
    this.offered = null
    this.problem = null
  }
}
