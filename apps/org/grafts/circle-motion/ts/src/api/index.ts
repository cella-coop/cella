// The graft's reads, its proposals and its slice, which the shell mounts:
// the circles a new motion may be put in, and on a circle's page what
// may be proposed about it. circle-membership-motion puts the proposal,
// read by `about` and made by `putting`, to the circle that decides it,
// fixing its roll in the same write.
import type { Db, Form, Slice } from '@cella/org-db'
import { forms, kinds } from '@cella/org-motion/api'
import { deciding, proposing } from '../drivers/proposing.ts'
import type { Kind, Put } from '../models/index.ts'

export { deciding, proposing } from '../drivers/proposing.ts'
export { putting } from '../handlers/put.ts'

// A motion about the circle whose page it is, read as its kind declares
// its arguments; the circle a nesting moves is the page's.
export async function about(form: Form, circle: string, db: Db): Promise<Put> {
  const kind = form.get('kind') as Kind
  const declared = (await kinds(db)).find((k) => k.kind === kind && ['nest', 'grant', 'revoke'].includes(k.kind))
  if (!declared) {
    throw new Error('choose what to propose')
  }
  if (!form.get('deadline')) {
    throw new Error('a motion needs a deadline')
  }
  const args = forms.args(form, declared.fields.filter((f) => !(kind === 'nest' && f.name === 'circle')))
  return { circle, kind, args, deadline: form.get('deadline'), body: form.get('body') }
}

export const slice: Slice = {
  name: 'circle-motion',
  extends: {
    motions: { about: async (db) => ({ circles: await deciding(db) }) },
    circles: { item: (db, circle) => proposing(db, circle) },
  },
}
