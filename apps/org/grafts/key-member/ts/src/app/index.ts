import { short, type App } from '@cella/org-ui'
import type { Keys } from '../models/index.ts'
import Devices from './blocks/Devices.svelte'
import Invite from './blocks/Invite.svelte'

// The graft's client side: the New form of the members collection, an
// invitation with its first device; and on a member's page their devices,
// with the first one until their admission enrols it.
export const app: App = {
  name: 'key-member',
  extends: {
    members: {
      create: Invite,
      page: {
        properties: ({ first: f }: Keys) =>
          f && !f.enrolled ? [{ label: 'First device', value: `${f.label} · ${short(f.key, 12)}, enrolled on admission`, kind: 'mono' as const }] : [],
        blocks: [Devices],
      },
    },
  },
}
