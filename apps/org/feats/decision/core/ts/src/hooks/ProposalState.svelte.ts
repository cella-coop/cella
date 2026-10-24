import type { Arg, Choice, Offered, Rule } from '../models/decision.ts'

// The New decision form's choices: the circle it is put in, the rule,
// which follows the circle's procedure until one is chosen, and the kind
// of motion, whose arguments the form then asks for.
export class ProposalState {
  circle = $state('')
  kind = $state('')
  #rule = $state<Rule | ''>('')
  readonly #offered: () => Offered

  constructor(offered: () => Offered) {
    this.#offered = offered
  }

  procedure = $derived.by((): Rule | '' => this.#offered().circles?.find((c) => c.id === this.circle)?.procedure ?? '')

  get rule(): Rule | '' {
    return this.#rule || this.procedure
  }

  set rule(r: Rule | '') {
    this.#rule = r
  }

  fields = $derived.by((): Arg[] => this.#offered().kinds.find((k) => k.kind === this.kind)?.fields ?? [])

  // The choices an argument names in the form's `about`, or none, for a
  // text box.
  choices(f: Arg): Choice[] | undefined {
    const list = f.options ? this.#offered()[f.options] : undefined
    return Array.isArray(list) ? (list as Choice[]) : undefined
  }
}
