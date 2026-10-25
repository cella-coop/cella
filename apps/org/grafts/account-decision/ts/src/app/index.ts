import type { App } from '@cella/org-ui'
import type { Adoption } from '../models/adoption.ts'
import Adopt from './blocks/Adopt.svelte'

const link = (a: { decision: string; title: string; closed: string | null }) => ({
  label: a.decision,
  sub: a.closed ? `${a.title}, closed ${a.closed}` : a.title,
  href: `/decisions/${a.decision}`,
})

// The graft's client side: the decisions moving to adopt the capital's
// terms, and adopting them from the terms' page; the terms a decision
// adopts, on the decision's.
export const app: App = {
  name: 'account-decision',
  extends: {
    terms: {
      page: {
        related: (a: Adoption[]) => a.map(link),
        actions: Adopt,
      },
    },
    decisions: {
      page: {
        related: (d: Adoption[]) =>
          d.map((x) => ({ label: `Capital terms from ${x.from}`, sub: x.adopted ? `adopted ${x.adopted}` : 'to adopt', href: `/terms/${x.terms}` })),
      },
    },
  },
}
