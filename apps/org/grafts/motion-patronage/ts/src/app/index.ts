import type { App } from '@cella/org-ui'
import type { Approval } from '../models/approval.ts'
import type { Adoption } from '../models/adoption.ts'
import Approve from './blocks/Approve.svelte'

const link = (a: { motion: string; title: string; closed: string | null }) => ({
  label: a.motion,
  sub: a.closed ? `${a.title}, closed ${a.closed}` : a.title,
  href: `/motions/${a.motion}`,
})

// The graft's client side: the motion approving a distribution, and
// approving it from its page; the motion that adopted the rule the work
// share's terms copy, on theirs; what a motion approves and adopts, on
// the motion's.
export const app: App = {
  name: 'motion-patronage',
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
      },
    },
    motions: {
      page: {
        related: (d: { approvals: Approval[]; adoptions: Adoption[] }) => [
          ...d.approvals.map((x) => ({ label: `${x.year} distribution`, sub: x.approved ? `approved ${x.approved}` : 'to approve', href: `/distributions/${x.distribution}` })),
          ...d.adoptions.map((x) => ({ label: `Patronage terms from ${x.from}`, sub: `adopted ${x.adopted}`, href: `/bases/${x.terms}` })),
        ],
      },
    },
  },
}
