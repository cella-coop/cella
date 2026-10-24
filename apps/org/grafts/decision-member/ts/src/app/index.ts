import type { App } from '@cella/org-ui'
import type { Admission } from '../models/admission.ts'

// The graft's client side: whom a decision admits, and the decision that
// admits a member.
export const app: App = {
  name: 'decision-member',
  extends: {
    decisions: {
      page: {
        properties: (a: Admission[]) => a.map((x) => ({ label: 'Admits', value: `${x.name ?? x.member}, ${x.shares} shares`, href: `/members/${x.member}` })),
        related: (a: Admission[]) => a.map((x) => ({ label: x.name ?? x.member, sub: 'to admit', href: `/members/${x.member}` })),
      },
    },
    members: {
      page: {
        related: (a: Admission[]) => a.map((x) => ({ label: x.decision, sub: 'admission', href: `/decisions/${x.decision}` })),
      },
    },
  },
}
