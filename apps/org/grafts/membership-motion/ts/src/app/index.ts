import type { App, Embed } from '@cella/org-ui'
import type { Asked, OnMotion } from '../models/admission.ts'
import Admits from './blocks/Admits.svelte'
import Named from './blocks/Named.svelte'

// The graft's client side: what a motion asks of members, the members
// its discussion names, drawn inside its messages, and the motions that
// ask something of a member.
export const app: App = {
  name: 'membership-motion',
  extends: {
    motions: {
      page: {
        related: (d: OnMotion) => d.asked.map((x) => ({ label: x.name ?? x.member, sub: x.kind, href: `/people/${x.member}` })),
        blocks: [Admits],
        embeds: { member: { label: 'Member', block: Named } satisfies Embed<OnMotion> },
      },
    },
    people: {
      page: {
        related: (a: Asked[]) => a.map((x) => ({ label: x.motion, sub: x.kind, href: `/motions/${x.motion}` })),
      },
    },
  },
}
