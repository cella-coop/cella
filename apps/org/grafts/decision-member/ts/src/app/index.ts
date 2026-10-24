import type { App } from '@cella/org-ui'
import type { Asked } from '../models/admission.ts'
import Admits from './blocks/Admits.svelte'

// The graft's client side: what a decision asks of members, and the
// decisions that ask something of a member.
export const app: App = {
  name: 'decision-member',
  extends: {
    decisions: {
      page: {
        related: (a: Asked[]) => a.map((x) => ({ label: x.name ?? x.member, sub: x.kind, href: `/members/${x.member}` })),
        blocks: [Admits],
      },
    },
    members: {
      page: {
        related: (a: Asked[]) => a.map((x) => ({ label: x.decision, sub: x.kind, href: `/decisions/${x.decision}` })),
      },
    },
  },
}
