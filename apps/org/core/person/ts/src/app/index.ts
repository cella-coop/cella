import { icons, type App, type Tone } from '@cella/org-ui'
import type { Person } from '../models/person.ts'
import type { Ask } from '../models/inbox.ts'
import Account from './blocks/Account.svelte'
import Devices from './blocks/Devices.svelte'
import Profile from './blocks/Profile.svelte'
import { columns } from './views/devices.ts'

// How each kind of ask stands out: what only the person can give first.
const asking: Record<string, Tone> = { stance: 'accent', mention: 'accent', approval: 'warning', invitation: 'positive', meeting: 'neutral' }

// Core person's client side as the shell mounts it: the people
// collection, everyone the co-op knows, and a person's page, which the
// feats fill with the membership and the employment they hold, and the grafts
// joining them with the rest; the inbox, what waits on the acting person;
// and every device.
export const app: App = {
  name: 'person',
  collections: {
    // What waits on the acting person, each linking to where it is done;
    // the sidebar counts it.
    inbox: {
      view: {
        group: 'home',
        title: 'Inbox',
        caption: 'What waits on you: stances to take, approvals, invitations, meetings to answer and mentions.',
        icon: icons.Tray,
        columns: [
          { key: 'what', label: 'What', kind: 'title', role: 'title', value: (a: Ask) => a.what },
          { key: 'about', label: 'About', role: 'sub', value: (a: Ask) => a.about },
          { key: 'kind', label: 'Kind', kind: 'badge', role: 'meta', value: (a: Ask) => a.kind, tone: (a: Ask) => asking[a.kind] ?? 'neutral' },
          { key: 'due', label: 'Due', kind: 'date', role: 'meta', value: (a: Ask) => a.due },
          { key: 'since', label: 'Since', kind: 'date', role: 'hidden', value: (a: Ask) => a.since },
        ],
        look: { layout: 'list', lanes: { kind: ['stance', 'approval', 'meeting', 'mention', 'invitation'] } },
        empty: 'Nothing waits on you.',
        linked: false,
        href: (a: Ask) => a.href,
        counted: true,
      },
    },
    people: {
      view: {
        title: 'People',
        caption: 'Everyone the co-op knows: its members and its workers, each by the address they sign with.',
        // One person, as each record of it is; a circle wears a group.
        icon: icons.User,
        columns: [
          { key: 'name', label: 'Name', kind: 'title', role: 'title', value: (p: Person) => p.name },
          { key: 'address', label: 'Address', kind: 'text', role: 'sub', value: (p: Person) => p.address },
        ],
      },
      page: {
        eyebrow: 'Person',
        title: (p: Person) => p.name,
        subtitle: (p: Person) => p.address,
        properties: (p: Person) => [{ label: 'Address', value: p.address }],
        // Four tabs, which the feats and grafts on a person fill: their
        // membership, joining and what they own and decide; their work,
        // employment, timesheets, payslips and records on file; and their
        // authority, seats, powers and the devices that sign for them.
        // Their tasks, expenses and the rest are jumps in Related.
        tabs: [
          { id: 'overview', label: 'Overview' },
          { id: 'membership', label: 'Membership' },
          { id: 'work', label: 'Work' },
          { id: 'authority', label: 'Authority' },
        ],
        blocks: [{ tab: 'authority', block: Devices }],
        actions: Profile,
      },
    },
    devices: {
      view: { group: 'platform', subgroup: 'Personal', title: 'Devices', icon: icons.SealCheck, columns, linked: false },
    },
  },
  // The acting person's own settings, first under Personal: their name,
  // contact details and theme, and their devices.
  settings: {
    account: {
      subgroup: 'Personal',
      title: 'Account',
      caption: 'Your name, how to reach you, your theme and the devices that sign your writes.',
      icon: icons.UserCircle,
      block: Account,
    },
  },
}
