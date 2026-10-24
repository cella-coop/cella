import { icons, type App, type Tone } from '@cella/org-ui'
import type { Member, Status } from '../models/member.ts'
import Profile from './blocks/Profile.svelte'

const tones: Record<Status, Tone> = { active: 'positive', invited: 'accent', suspended: 'warning', exited: 'neutral' }

// The feat's client side as the shell mounts it: the members collection's
// view and a member's page.
export const app: App = {
  name: 'member',
  collections: {
    members: {
      view: {
        group: 'governance',
        title: 'Members',
        icon: icons.Users,
        columns: [
          { key: 'name', label: 'Name', kind: 'title', role: 'title', value: (m: Member) => m.name },
          { key: 'address', label: 'Address', kind: 'mono', role: 'sub', value: (m: Member) => m.address },
          { key: 'shares', label: 'Shares', kind: 'number', role: 'hidden', value: (m: Member) => m.shares },
          { key: 'since', label: 'Since', kind: 'date', role: 'meta', value: (m: Member) => m.since },
          { key: 'status', label: 'Status', kind: 'badge', role: 'meta', value: (m: Member) => m.status, tone: (m: Member) => tones[m.status] },
        ],
      },
      page: {
        eyebrow: 'Member',
        title: (m: Member) => m.name,
        subtitle: (m: Member) => m.address,
        properties: (m: Member) => [
          { label: 'Status', value: m.status, kind: 'badge', tone: tones[m.status] },
          { label: 'Since', value: m.since, kind: 'date' },
          { label: 'Shares', value: m.shares, kind: 'number' },
          { label: 'Address', value: m.address, kind: 'mono' },
        ],
        actions: Profile,
      },
    },
  },
}
