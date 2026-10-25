import type { App, Embed } from '@cella/org-ui'
import type { Asked, OnDecision } from '../models/admission.ts'
import Admits from './blocks/Admits.svelte'
import Named from './blocks/Named.svelte'

// The graft's client side: what a decision asks of members, the members
// its discussion names, drawn inside its messages, and the decisions that
// ask something of a member.
export const app: App = {
  name: 'decision-member',
  extends: {
    decisions: {
      page: {
        related: (d: OnDecision) => d.asked.map((x) => ({ label: x.name ?? x.member, sub: x.kind, href: `/members/${x.member}` })),
        blocks: [Admits],
        embeds: { member: { label: 'Member', block: Named } satisfies Embed<OnDecision> },
      },
    },
    members: {
      page: {
        related: (a: Asked[]) => a.map((x) => ({ label: x.decision, sub: x.kind, href: `/decisions/${x.decision}` })),
      },
    },
  },
}
