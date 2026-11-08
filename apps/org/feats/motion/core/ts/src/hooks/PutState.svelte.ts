import { reads, worded, type Held, type Kind } from '../models/circles.ts'

// What a circle's Propose form proposes, whose arguments it then asks
// for, and a grant's or a change's values as typed, from which the form
// shows the mandate policy's sentence as it will read. Choosing a mandate
// to change fills the values from it.
export class PutState {
  kind = $state<Kind>('grant')
  policy = $state('')
  grantee = $state('')
  power = $state('')
  text = $state('')
  limit = $state<string | number>('')
  budget = $state<string | number>('')
  per = $state('')
  scope = $state('')
  from = $state('')
  until = $state('')

  // On a mandate's page, a change of that mandate from the start.
  constructor(changing?: Held) {
    if (changing) {
      this.kind = 'change'
      this.choose(changing.policy, [changing])
    }
  }

  // The sentence the policy will read, its marks dropped, once it names
  // its grantee and its power.
  sentence = $derived.by(() => {
    if (!this.grantee || !this.power) {
      return ''
    }
    const [what, id] = this.grantee.split(':')
    return reads(
      worded({
        [what === 'circle' ? 'circle' : 'role']: id ?? '',
        power: this.power,
        text: this.text,
        limit: this.limit,
        budget: this.budget,
        per: this.per,
        scope: this.scope,
      }),
    )
  })

  // A change starts from the mandate it replaces.
  choose(policy: string, held: Held[]) {
    this.policy = policy
    const m = held.find((h) => h.policy === policy)
    if (!m) {
      return
    }
    this.grantee = m.grantee
    this.power = m.power
    this.text = m.text
    this.limit = m.limit ?? ''
    this.budget = m.budget ?? ''
    this.per = m.per ?? ''
    this.scope = m.scope ?? ''
    this.from = ''
    this.until = m.until ?? ''
  }
}
