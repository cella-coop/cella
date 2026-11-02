// The graft's reads, its proposals, its writes and its slice, which the
// shell mounts: the circles a new motion may be put in, and on a circle's
// page what may be proposed about it. circle-membership-motion puts the
// proposal, read by `about` and made by `putting`, to the circle that
// decides it, fixing its roll in the same write, and carries out each
// policy a passing motion adopts or ends through `adopt` and `end`.
import type { Db, Form, Slice } from '@cella/org-db'
import { forms, kinds } from '@cella/org-motion/api'
import type { Arg } from '@cella/org-motion/models'
import { deciding, proposing } from '../drivers/proposing.ts'
import type { Kind, Put } from '../models/index.ts'

export { deciding, proposing } from '../drivers/proposing.ts'
export { putting, worded } from '../handlers/put.ts'
export { adopt, end } from '../handlers/policy.ts'

// What a grant and a revocation ask for: a mandate is a policy, so its
// form is this graft's, and `putting` words it.
const asked: Record<'grant' | 'revoke', Arg[]> = {
  grant: [
    { name: 'role', label: 'Role', type: 'text' },
    { name: 'power', label: 'Power', type: 'text' },
    { name: 'text', label: 'Grants', type: 'text', optional: true },
    { name: 'limit', label: 'Limit per write, €', type: 'number', optional: true },
    { name: 'budget', label: 'Budget, €', type: 'number', optional: true },
    { name: 'per', label: 'Budget per', type: 'text', optional: true },
  ],
  revoke: [{ name: 'policy', label: 'Mandate', type: 'text' }],
}

// A motion about the circle whose page it is, read as its kind declares
// its arguments; the circle a nesting moves is the page's.
export async function about(form: Form, circle: string, db: Db): Promise<Put> {
  const kind = form.get('kind') as Kind
  const fields = kind === 'grant' || kind === 'revoke' ? asked[kind] : kind === 'nest' ? (await kinds(db)).find((k) => k.kind === 'nest')?.fields : undefined
  if (!fields) {
    throw new Error('choose what to propose')
  }
  if (!form.get('deadline')) {
    throw new Error('a motion needs a deadline')
  }
  const args = forms.args(form, fields.filter((f) => !(kind === 'nest' && f.name === 'circle')))
  return { circle, kind, args, deadline: form.get('deadline'), body: form.get('body') }
}

export const slice: Slice = {
  name: 'circle-motion',
  extends: {
    motions: { about: async (db) => ({ circles: await deciding(db) }) },
    circles: { item: (db, circle) => proposing(db, circle) },
  },
}
