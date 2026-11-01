import type { Arg, Choice, Offered } from '../models/motion.ts'

// The New motion form's choices: the circle it is put in, the
// procedure, which follows the circle's until one is chosen, and the kind
// of action, whose arguments the form then asks for.
export class ProposalState {
  circle = $state('')
  kind = $state('')
  #procedure = $state('')
  readonly #offered: () => Offered

  constructor(offered: () => Offered) {
    this.#offered = offered
  }

  // The procedure the circle decides by.
  usual = $derived.by((): string => this.#offered().circles?.find((c) => c.id === this.circle)?.procedure ?? '')

  get procedure(): string {
    return this.#procedure || this.usual
  }

  set procedure(p: string) {
    this.#procedure = p
  }

  fields = $derived.by((): Arg[] => this.#offered().kinds.find((k) => k.kind === this.kind)?.fields ?? [])

  // The choices an argument names in the form's `about`, or none, for a
  // text box.
  choices(f: Arg): Choice[] | undefined {
    const list = f.options ? this.#offered()[f.options] : undefined
    return Array.isArray(list) ? (list as Choice[]) : undefined
  }
}
