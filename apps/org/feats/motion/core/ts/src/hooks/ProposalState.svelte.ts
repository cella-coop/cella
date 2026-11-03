import type { Arg, Choice, Offered } from '../models/motion.ts'

// The New motion form's choices: the circle it is put in and the kind of
// action, whose arguments the form then asks for. It names no procedure:
// the motion's requirements fix the one it is decided by.
export class ProposalState {
  circle = $state('')
  kind = $state('')
  readonly #offered: () => Offered

  constructor(offered: () => Offered) {
    this.#offered = offered
  }

  fields = $derived.by((): Arg[] => this.#offered().kinds.find((k) => k.kind === this.kind)?.fields ?? [])

  // The choices an argument names in the form's `about`, or none, for a
  // text box.
  choices(f: Arg): Choice[] | undefined {
    const list = f.options ? this.#offered()[f.options] : undefined
    return Array.isArray(list) ? (list as Choice[]) : undefined
  }
}
