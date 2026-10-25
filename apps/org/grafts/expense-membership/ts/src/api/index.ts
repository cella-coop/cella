// The graft's reads and its slice, which the shell mounts: whose each
// expense is and who decided it, and a member's expenses on their page.
import type { Slice } from '@cella/org-db'
import { claim, claimed, claims } from '../drivers/claim.ts'

export { claim, claimed, claims } from '../drivers/claim.ts'

export const slice: Slice = {
  name: 'expense-membership',
  extends: {
    expenses: { list: claims, item: claim },
    people: { item: claimed },
  },
}
