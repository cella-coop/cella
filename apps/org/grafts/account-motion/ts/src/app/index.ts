import type { App } from '@cella/org-ui'
import type { Adoption } from '../models/adoption.ts'

// The graft's client side: the motion that adopted the rule capital terms
// copy, on the terms' page; the terms a motion's rules made, on the
// motion's.
export const app: App = {
  name: 'account-motion',
  extends: {
    terms: {
      page: {
        related: (a: Adoption[]) =>
          a.map((x) => ({ label: x.motion, sub: x.closed ? `${x.title}, closed ${x.closed}` : x.title, href: `/motions/${x.motion}` })),
      },
    },
    motions: {
      page: {
        related: (d: Adoption[]) => d.map((x) => ({ label: `Capital terms from ${x.from}`, sub: `adopted ${x.adopted}`, href: `/terms/${x.terms}` })),
      },
    },
  },
}
