// The feat's circles: their reads, proposals, writes and slice, which the
// shell mounts: the circles a new motion may be put in, and on a circle's
// page, or a mandate's, what may be proposed about it. membership-motion puts the
// proposal, read by `about` or `revised` and made by `putting`, to the circle that
// decides it, fixing its roll in the same write, and carries out each
// policy a passing motion adopts or ends through `adopt` and `end`.
import type { Db, Form, Slice } from '@cella/org-db'
import * as forms from './forms.ts'
import type { Arg } from '../models/index.ts'
import { deciding, issuing, proposing, revising } from '../drivers/proposing.ts'
import type { Kind, Put } from '../models/circles.ts'

export { deciding, issuing, proposing, revising } from '../drivers/proposing.ts'
export { putting, worded } from '../handlers/put.ts'
export { adopt, end } from '../handlers/policy.ts'

// What a grant, a change and a revocation ask for: a mandate is a policy,
// so its form is this feat's, and `putting` words it. A grant names its
// grantee, `role:<id>` or `circle:<id>`, and perhaps the circle whose
// motion issues it; a change, the mandate it replaces and the values it
// grants instead. Setting open books' disclosure values asks for the
// three; withholding them, for the rule in force it ends.
const granted: Arg[] = [
  { name: 'grantee', label: 'Grantee', type: 'text', optional: true },
  { name: 'role', label: 'Role', type: 'text', optional: true },
  { name: 'power', label: 'Power', type: 'text' },
  { name: 'text', label: 'Grants', type: 'text', optional: true },
  { name: 'limit', label: 'Limit per write, €', type: 'number', optional: true },
  { name: 'budget', label: 'Budget, €', type: 'number', optional: true },
  { name: 'per', label: 'Budget per', type: 'text', optional: true },
  { name: 'scope', label: 'Covers', type: 'text', optional: true },
  { name: 'from', label: 'From', type: 'text', optional: true },
  { name: 'until', label: 'Until', type: 'text', optional: true },
]
const asked: Record<Kind, Arg[]> = {
  grant: [...granted, { name: 'issuer', label: 'Issued by', type: 'text', optional: true }],
  change: [{ name: 'policy', label: 'Mandate', type: 'text' }, ...granted],
  revoke: [{ name: 'policy', label: 'Mandate', type: 'text' }],
  disclose: [
    { name: 'contributors', label: 'Fewest people in a total', type: 'number' },
    { name: 'largest', label: 'Most one person may put in, %', type: 'number' },
    { name: 'two', label: 'Most two people may put in, %', type: 'number' },
  ],
  withhold: [{ name: 'policy', label: 'Rule', type: 'text' }],
}

// A motion about the circle whose page it is, read as its kind declares
// its arguments; a grantee chosen as `role:<id>` or `circle:<id>` is the
// role or the circle the policy marks.
export async function about(form: Form, circle: string, db: Db): Promise<Put> {
  const kind = form.get('kind') as Kind
  const fields = Object.hasOwn(asked, kind) ? asked[kind] : undefined
  if (!fields) {
    throw new Error('choose what to propose')
  }
  if (!form.get('deadline')) {
    throw new Error('a motion needs a deadline')
  }
  const { grantee, ...args } = forms.args(form, fields)
  if (grantee !== undefined) {
    const [what, id] = String(grantee).split(':')
    if ((what !== 'role' && what !== 'circle') || !id) {
      throw new Error(`a mandate is granted to a role or a circle, as role:finance or circle:web, not “${grantee}”`)
    }
    args[what] = id
  }
  return { circle, kind, args, deadline: form.get('deadline'), body: form.get('body') }
}

// A change or a revocation proposed from a mandate's page: a motion about
// the circle whose page lists it, of its own policy, read as `about`
// reads one from that page.
export async function revised(form: Form, mandate: string, db: Db): Promise<Put> {
  const found = await revising(db, mandate)
  if (!found) {
    throw new Error(`mandate ${mandate} does not stand today, so there is nothing to change or revoke`)
  }
  const put = await about(form, found.circle, db)
  if (put.kind !== 'change' && put.kind !== 'revoke') {
    throw new Error('a mandate\'s page changes or revokes it')
  }
  return { ...put, args: { ...put.args, policy: found.held.policy } }
}

export const slice: Slice = {
  name: 'motion/circles',
  extends: {
    motions: { about: async (db) => ({ circles: await deciding(db) }), item: (db, motion) => issuing(db, motion) },
    circles: { item: (db, circle) => proposing(db, circle) },
    mandates: { item: (db, mandate) => revising(db, mandate) },
  },
}
