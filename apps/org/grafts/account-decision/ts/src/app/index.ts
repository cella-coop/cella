import type { App } from '@cella/org-ui'
import type { Approval } from '../models/approval.ts'
import Allocate from './blocks/Allocate.svelte'

const link = (a: Approval) => ({ label: a.decision, sub: a.closed ? `${a.title}, closed ${a.closed}` : a.title, href: `/decisions/${a.decision}` })

// The graft's client side: the decision approving an allocation, and
// allocating it from its page; what a decision allocates, on the
// decision's.
export const app: App = {
  name: 'account-decision',
  extends: {
    allocations: {
      page: {
        related: (a: Approval[]) => a.map(link),
        actions: Allocate,
      },
    },
    decisions: {
      page: {
        related: (a: Approval[]) => a.map((x) => ({ label: `${x.year} surplus`, sub: x.allocated ? `allocated ${x.allocated}` : 'to allocate', href: `/allocations/${x.allocation}` })),
      },
    },
  },
}
