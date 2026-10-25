import type { App } from '@cella/org-ui'
import type { Approval } from '../models/approval.ts'
import type { Adoption } from '../models/adoption.ts'
import Allocate from './blocks/Allocate.svelte'
import Adopt from './blocks/Adopt.svelte'

const link = (a: { decision: string; title: string; closed: string | null }) => ({
  label: a.decision,
  sub: a.closed ? `${a.title}, closed ${a.closed}` : a.title,
  href: `/decisions/${a.decision}`,
})

// The graft's client side: the decision approving an allocation, and
// allocating it from its page; the decisions moving to adopt terms, and
// adopting them from theirs; what a decision allocates and adopts, on the
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
    terms: {
      page: {
        related: (a: Adoption[]) => a.map(link),
        actions: Adopt,
      },
    },
    decisions: {
      page: {
        related: (d: { approvals: Approval[]; adoptions: Adoption[] }) => [
          ...d.approvals.map((x) => ({ label: `${x.year} surplus`, sub: x.allocated ? `allocated ${x.allocated}` : 'to allocate', href: `/allocations/${x.allocation}` })),
          ...d.adoptions.map((x) => ({ label: `Terms from ${x.from}`, sub: x.adopted ? `adopted ${x.adopted}` : 'to adopt', href: `/terms/${x.terms}` })),
        ],
      },
    },
  },
}
