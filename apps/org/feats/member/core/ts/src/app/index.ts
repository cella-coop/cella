import { icons, type App, type Tone } from '@cella/org-ui'
import type { Member, Status } from '../models/member.ts'
import Joining from './blocks/Joining.svelte'
import Profile from './blocks/Profile.svelte'
import Rights from './blocks/Rights.svelte'

const tones: Record<Status, Tone> = { active: 'positive', invited: 'accent', suspended: 'warning', exited: 'neutral' }

// The feat's client side as the shell mounts it: the members collection's
// view and a member's page, its tabs the overview, joining, the steps
// joining asks, and what a member owns and decides, which the grafts
// joining member fill beside the feat's own.
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
          { label: 'Invited', value: m.invited, kind: 'date' },
          { label: 'Since', value: m.since, kind: 'date' },
          ...(m.suspended ? [{ label: 'Suspended', value: m.suspended, kind: 'date' as const }] : []),
          ...(m.exited ? [{ label: 'Exited', value: m.exited, kind: 'date' as const }] : []),
          { label: 'Shares', value: m.shares, kind: 'number' },
          { label: 'Address', value: m.address, kind: 'mono' },
        ],
        tabs: [
          { id: 'overview', label: 'Overview' },
          { id: 'joining', label: 'Joining' },
          { id: 'rights', label: 'Own and decide' },
        ],
        blocks: [
          { tab: 'joining', block: Joining },
          { tab: 'rights', block: Rights },
        ],
        actions: Profile,
      },
    },
  },
}
