// Core's graft joining the circles to the policy register: a mandate's
// grant and revocation as its policy is adopted and ends, which the motion
// feat's writes extend; and its slice, which gives a mandate's page its
// policy's sentence and the motion that adopted it.
import type { Slice } from '@cella/org-db'
import { worded } from '../drivers/mandate.ts'

export { granting, revoking } from '../handlers/index.ts'
export { worded } from '../drivers/mandate.ts'

export const slice: Slice = {
  name: 'circle-policy',
  extends: {
    mandates: {
      item: worded,
    },
  },
}
