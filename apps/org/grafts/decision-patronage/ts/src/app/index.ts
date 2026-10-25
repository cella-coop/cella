import type { App } from '@cella/org-ui'
import type { Approval } from '../models/approval.ts'
import type { Adoption } from '../models/adoption.ts'
import Approve from './blocks/Approve.svelte'
import Adopt from './blocks/Adopt.svelte'

const link = (a: { decision: string; title: string; closed: string | null }) => ({
  label: a.decision,
  sub: a.closed ? `${a.title}, closed ${a.closed}` : a.title,
  href: `/decisions/${a.decision}`,
})

// The graft's client side: the decision approving a distribution, and
// approving it from its page; the decisions moving to adopt the work
// share's terms, and adopting them from theirs; what a decision approves
// and adopts, on the decision's.
export const app: App = {
  name: 'decision-patronage',
  extends: {
    distributions: {
      page: {
        related: (a: Approval[]) => a.map(link),
        actions: Approve,
      },
    },
    bases: {
      page: {
        related: (a: Adoption[]) => a.map(link),
        actions: Adopt,
      },
    },
    decisions: {
      page: {
        related: (d: { approvals: Approval[]; adoptions: Adoption[] }) => [
          ...d.approvals.map((x) => ({ label: `${x.year} distribution`, sub: x.approved ? `approved ${x.approved}` : 'to approve', href: `/distributions/${x.distribution}` })),
          ...d.adoptions.map((x) => ({ label: `Patronage terms from ${x.from}`, sub: x.adopted ? `adopted ${x.adopted}` : 'to adopt', href: `/bases/${x.terms}` })),
        ],
      },
    },
  },
}
