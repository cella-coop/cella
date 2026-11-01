import type { App } from '@cella/org-ui'
import type { Adoption } from '../models/adoption.ts'
import Adopt from './blocks/Adopt.svelte'

const link = (a: { motion: string; title: string; closed: string | null }) => ({
  label: a.motion,
  sub: a.closed ? `${a.title}, closed ${a.closed}` : a.title,
  href: `/motions/${a.motion}`,
})

// The graft's client side: the motions moving to adopt the capital's
// terms, and adopting them from the terms' page; the terms a motion
// adopts, on the motion's.
export const app: App = {
  name: 'account-motion',
  extends: {
    terms: {
      page: {
        related: (a: Adoption[]) => a.map(link),
        actions: Adopt,
      },
    },
    motions: {
      page: {
        related: (d: Adoption[]) =>
          d.map((x) => ({ label: `Capital terms from ${x.from}`, sub: x.adopted ? `adopted ${x.adopted}` : 'to adopt', href: `/terms/${x.terms}` })),
      },
    },
  },
}
