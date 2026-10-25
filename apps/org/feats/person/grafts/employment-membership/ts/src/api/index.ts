// The graft's write, POST /api/employment-membership/<op> once the server exists,
// its reads, and its slice, which the shell mounts.
import { action, type Form, type Slice } from '@cella/org-db'
import { open } from '../handlers/open.ts'
import { path, stages } from '../drivers/path.ts'
import type { Open } from '../models/path.ts'

export { open } from '../handlers/open.ts'
export { path, stages } from '../drivers/path.ts'

// What the candidacy form sends: the probation's days and the shares.
export function opening(form: Form, worker: string): Open {
  const shares = Number(form.get('shares'))
  if (!Number.isInteger(shares) || shares <= 0) {
    throw new Error(`“${form.get('shares')}” is not a whole number of shares`)
  }
  return { worker, from: form.get('from'), to: form.get('to'), shares }
}

// Each person's stage on their way to membership; on their page, the
// path they took, and opening a worker's candidacy.
export const slice: Slice = {
  name: 'employment-membership',
  extends: {
    people: {
      list: stages,
      item: (db, address) => path(db, address),
      actions: {
        candidacy: action('employment-membership:candidacy:open', (form, id) => opening(form, id ?? ''), open),
      },
    },
  },
}
