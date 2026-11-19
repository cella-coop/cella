import type { Db, Form } from '@cella/org-db'
import type { Propose } from '@cella/org-motion/models'
import { organization, ruling } from '../drivers/asking.ts'
import { particulars as names, type Applying, type Asking, type Particular } from '../models/asking.ts'

const when = (form: Form) => {
  if (!form.get('deadline')) {
    throw new Error('a motion needs a deadline')
  }
  return { deadline: form.get('deadline'), body: form.get('body') }
}

// A proposal from a member's page: to admit them with their shares, to
// suspend them or to exclude them.
export function standing(form: Form, member: string): Asking {
  const kind = form.get('kind')
  if (kind === 'admit') {
    const shares = Number(form.get('shares'))
    if (!Number.isInteger(shares) || shares <= 0) {
      throw new Error(`“${form.get('shares')}” is not a whole number of shares`)
    }
    return { kind, args: { member, shares }, ...when(form) }
  }
  if (kind === 'suspend' || kind === 'exclude') {
    return { kind, args: { member }, ...when(form) }
  }
  throw new Error('choose what to propose')
}

// A proposal from a circle's page: to seat a member in it, in a role or as
// a plain member, or to end a seat held there, named by its id.
export async function appointing(form: Form, circle: string, db: Db): Promise<Asking> {
  const kind = form.get('kind')
  if (kind === 'seat') {
    const role = form.get('role')
    return { kind, args: { circle, member: form.get('member'), ...(role ? { role } : {}) }, ...when(form) }
  }
  if (kind === 'unseat') {
    const { rows } = await db.query<{ member: string; role: string | null }>(
      'SELECT member, role FROM circle.seat WHERE id::text = $1 AND circle = $2 AND until IS NULL',
      [form.get('seat'), circle],
    )
    if (!rows[0]) {
      throw new Error('choose a seat held in this circle')
    }
    return { kind, args: { circle, member: rows[0].member, ...(rows[0].role ? { role: rows[0].role } : {}) }, ...when(form) }
  }
  throw new Error('choose what to propose')
}

// An employee's application from their own page: the shares they pledge,
// and the deadline and reasons of the motion it puts to the assembly.
export function applying(form: Form, member: string): Applying {
  const shares = Number(form.get('shares'))
  if (!Number.isInteger(shares) || shares <= 0) {
    throw new Error(`“${form.get('shares')}” is not a whole number of shares`)
  }
  return { member, shares, ...when(form) }
}

// The coop's particulars as a rule of its assembly, each value marked
// once, worded as the founding words them from scope.toml
// (tools/seed/found.mjs): a value left empty is left out, its name never.
export function worded(p: Record<Particular, string | null> & { logo?: string | null }): string {
  const mark = (name: Particular) => `{particulars_${name}: ${p[name]}}`
  return [
    `The coop is called ${mark('name')}`,
    p.legal_name ? `, its legal name ${mark('legal_name')}` : '',
    p.form ? `, a ${mark('form')}` : '',
    p.capital ? ` with a capital of ${mark('capital')}` : '',
    p.seat ? `, whose seat is ${mark('seat')}` : '',
    p.siren ? `, registered under SIREN ${mark('siren')}` : '',
    p.rcs ? `${p.siren ? '' : ', registered'} at the trade register of ${mark('rcs')}` : '',
    p.vat ? `, with the VAT number ${mark('vat')}` : '',
    p.logo ? `, and bears the mark {particulars_logo: ${p.logo}}` : '',
  ].join('')
}

// An argument as a form or a basket gives it: its value where it is
// given at all, else none.
type Given = (name: string) => string | undefined
type Action = Propose['actions'][number]

const fromForm =
  (form: Form): Given =>
  (name) =>
    form.all(`arg.${name}`).length > 0 ? form.get(`arg.${name}`) : undefined

// The coop's particulars adopted again as a rule of its assembly, each
// value given (`particulars_<name>`) in place of the one in force and the
// rest as they stand, replacing those in force with the protection they
// had.
async function reparticular(given: Given, db: Db): Promise<Action> {
  const now = await organization(db)
  if (!now.particulars) {
    throw new Error('the coop has no particulars in force to change: its founding motion adopts them')
  }
  const values: Record<Particular, string | null> & { logo: string | null } = { ...now.particulars }
  for (const name of names) {
    const v = given(`particulars_${name}`)
    if (v !== undefined) {
      values[name] = v.trim() || null
    }
  }
  if (!values.name) {
    throw new Error('the coop is called by a name: type the name it goes by')
  }
  const args = { kind: 'rule', wording: worded(values), replaces: now.particulars.policy, ...(now.protected ? { protected: now.protected } : {}) }
  return { kind: 'policy', args }
}

// A proposal from Settings' Organization page: a motion of the assembly
// adopting the particulars again, each value typed (`arg.particulars_<name>`)
// in place of the one in force and the rest as they stand.
export async function particulars(form: Form, db: Db): Promise<Propose> {
  return { circle: form.get('circle'), title: form.get('title'), ...when(form), actions: [await reparticular(fromForm(form), db)] }
}

// A setting rule, worded: the circle adopting it sets the setting to its
// value, for the circle it names where that is another, each marked once.
export function ruled(adopting: string, setting: string, value: string, circle?: string): string {
  return `${adopting} sets {setting: ${setting}} to {value: ${value}}${circle ? ` for {circle: ${circle}}` : ''}`
}

// A `rule` for each of a circle's settings given as other than it stands,
// adopted by the circle that decides, naming the circle where the
// assembly decides for another, each replacing the rule that set the
// circle's value where one stands.
async function rules(given: Given, circle: string, db: Db): Promise<Action[]> {
  const now = await ruling(db, circle)
  if (!now) {
    throw new Error(`no circle ${circle}`)
  }
  return now.settings
    .filter((s) => given(s.name) !== undefined && given(s.name)!.trim().toLowerCase() !== s.value)
    .map((s) => ({
      kind: 'policy',
      args: {
        kind: 'rule',
        wording: ruled(now.decider.name, s.name, given(s.name)!.trim().toLowerCase(), now.decider.circle === now.circle ? undefined : now.circle),
        ...(s.set_by === 'circle' && s.policy ? { replaces: s.policy } : {}),
      },
    }))
}

// A proposal from a circle's rules page: a motion of the circle that
// decides carrying a rule for each setting typed (`arg.<setting>`) as
// other than it stands.
export async function settings(form: Form, circle: string, db: Db): Promise<Propose> {
  const actions = await rules(fromForm(form), circle, db)
  if (!actions.length) {
    throw new Error('change a setting to propose its rule')
  }
  return { circle: form.get('circle'), title: form.get('title'), ...when(form), actions }
}

// A change waiting to be proposed, as the changes to propose post it:
// the settings page it was made on, the one thing that page is of, the
// setting and its value.
export interface Waiting {
  page: string
  id: string
  field: string
  value: string
}

// A switch's value as a motion carries it, `yes` or `no`.
const yes = (v: string) => (v === 'yes' ? 'yes' : 'no')

function waiting(raw: string): Waiting[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw || '[]')
  } catch {
    throw new Error('the changes to propose are unreadable: gather them again')
  }
  if (!Array.isArray(parsed) || !parsed.every((c) => c && ['page', 'id', 'field', 'value'].every((k) => typeof c[k] === 'string'))) {
    throw new Error('the changes to propose name a page, a thing, a setting and a value each: gather them again')
  }
  return parsed as Waiting[]
}

// A proposal from the changes to propose: one motion of the circle that
// decides them carrying every change, each turned into the action its
// page proposes, never the action a client names: the coop's
// particulars, all of them changed, as one rule of the assembly; the
// coop's features as an `arrange-features` of its root, a circle's group
// shown as a `show-group` and its feature shown as a `hide-feature`; a
// circle's settings, those of one circle, as a rule each. The guards judge each
// action as the page's own proposal is judged.
export async function basket(form: Form, db: Db): Promise<Propose> {
  const changes = waiting(form.get('changes'))
  if (!changes.length) {
    throw new Error('no change waits to be proposed: change a setting first')
  }
  const groups = new Map<string, Waiting[]>()
  for (const c of changes) {
    const key = c.page === 'features' ? `features/${c.id}/${c.field}` : `${c.page}/${c.id}`
    groups.set(key, [...(groups.get(key) ?? []), c])
  }
  const actions: Action[] = []
  for (const group of groups.values()) {
    const { page, id } = group[0]!
    const given: Given = (name) => group.findLast((c) => c.field === name)?.value
    if (page === 'organization') {
      actions.push(await reparticular((name) => given(name.replace(/^particulars_/, '')), db))
    } else if (page === 'features' && group[0]!.field === 'features') {
      actions.push({ kind: 'arrange-features', args: { circle: id, features: group.at(-1)!.value } })
    } else if (page === 'features' && group[0]!.field.startsWith('group:')) {
      actions.push({ kind: 'show-group', args: { circle: id, group: group[0]!.field.slice('group:'.length), shown: yes(group.at(-1)!.value) } })
    } else if (page === 'features' && group[0]!.field.startsWith('feature:')) {
      // A feature's switch is on where the circle shows it.
      actions.push({ kind: 'hide-feature', args: { circle: id, feature: group[0]!.field.slice('feature:'.length), hidden: yes(group.at(-1)!.value) === 'yes' ? 'no' : 'yes' } })
    } else if (page === 'rules') {
      // A circle's settings are ruled by the circle that decides them, so
      // a motion of any other circle would word the rule as its own and
      // set its own setting, not the one the change was made on.
      const now = await ruling(db, id)
      if (now && now.decider.circle !== form.get('circle')) {
        throw new Error(`${now.decider.name} decides ${id}'s settings: propose them in a motion of ${now.decider.name}`)
      }
      actions.push(...(await rules(given, id, db)))
    } else {
      throw new Error(`${group[0]!.field} on the ${page} page is not proposed by motion here: propose it from its own page`)
    }
  }
  if (!actions.length) {
    throw new Error('the changes to propose change nothing that stands: change a setting first')
  }
  return { circle: form.get('circle'), title: form.get('title'), ...when(form), actions }
}
