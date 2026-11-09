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

// The co-op's particulars as a rule of its assembly, each value marked
// once, worded as the founding words them from scope.toml
// (tools/seed/found.mjs): a value left empty is left out, its name never.
export function worded(p: Record<Particular, string | null>): string {
  const mark = (name: Particular) => `{particulars_${name}: ${p[name]}}`
  return [
    `The co-op is called ${mark('name')}`,
    p.legal_name ? `, its legal name ${mark('legal_name')}` : '',
    p.form ? `, a ${mark('form')}` : '',
    p.capital ? ` with a capital of ${mark('capital')}` : '',
    p.seat ? `, whose seat is ${mark('seat')}` : '',
    p.siren ? `, registered under SIREN ${mark('siren')}` : '',
    p.rcs ? `${p.siren ? '' : ', registered'} at the trade register of ${mark('rcs')}` : '',
    p.vat ? `, with the VAT number ${mark('vat')}` : '',
  ].join('')
}

// A proposal from Settings' Organization page: a motion of the assembly
// adopting the particulars again, each value typed (`arg.particulars_<name>`)
// in place of the one in force and the rest as they stand, as a rule
// replacing those in force with the protection they had.
export async function particulars(form: Form, db: Db): Promise<Propose> {
  const now = await organization(db)
  if (!now.particulars) {
    throw new Error('the co-op has no particulars in force to change: its founding motion adopts them')
  }
  const values: Record<Particular, string | null> = { ...now.particulars }
  for (const name of names) {
    if (form.all(`arg.particulars_${name}`).length > 0) {
      values[name] = form.get(`arg.particulars_${name}`).trim() || null
    }
  }
  if (!values.name) {
    throw new Error('the co-op is called by a name: type the name it goes by')
  }
  const args = { kind: 'rule', wording: worded(values), replaces: now.particulars.policy, ...(now.protected ? { protected: now.protected } : {}) }
  return { circle: form.get('circle'), title: form.get('title'), ...when(form), actions: [{ kind: 'policy', args }] }
}

// A setting rule, worded: the circle adopting it sets the setting to its
// value, for the circle it names where that is another, each marked once.
export function ruled(adopting: string, setting: string, value: string, circle?: string): string {
  return `${adopting} sets {setting: ${setting}} to {value: ${value}}${circle ? ` for {circle: ${circle}}` : ''}`
}

// A proposal from a circle's rules page: a motion of the circle that
// decides carrying a `rule` for each setting typed (`arg.<setting>`) as
// other than it stands, naming the circle where the assembly decides for
// another, each replacing the rule that set the circle's value where one
// stands.
export async function settings(form: Form, circle: string, db: Db): Promise<Propose> {
  const now = await ruling(db, circle)
  if (!now) {
    throw new Error(`no circle ${circle}`)
  }
  const actions = now.settings
    .filter((s) => form.all(`arg.${s.name}`).length > 0 && form.get(`arg.${s.name}`).trim().toLowerCase() !== s.value)
    .map((s) => ({
      kind: 'policy',
      args: {
        kind: 'rule',
        wording: ruled(now.decider.name, s.name, form.get(`arg.${s.name}`).trim().toLowerCase(), now.decider.circle === now.circle ? undefined : now.circle),
        ...(s.set_by === 'circle' && s.policy ? { replaces: s.policy } : {}),
      },
    }))
  if (!actions.length) {
    throw new Error('change a setting to propose its rule')
  }
  return { circle: form.get('circle'), title: form.get('title'), ...when(form), actions }
}
