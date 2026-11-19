import { icons, short, type App, type Tone } from '@cella/org-ui'
import { chips, type Membership, type Status } from '../models/member.ts'
import Device from './blocks/Device.svelte'
import Invite from './blocks/Invite.svelte'
import Joining from './blocks/Joining.svelte'
import Rights from './blocks/Rights.svelte'
import Standing from './blocks/Standing.svelte'
import Withdraw from './blocks/Withdraw.svelte'
import Erase from './blocks/Erase.svelte'

const tones: Record<Status, Tone> = { active: 'positive', invited: 'accent', suspended: 'warning', exited: 'neutral' }

// A person's row as the membership adds to it, where they hold one.
type Row = { status?: Status; member?: string; since?: string | null; shares?: number }

// The feat's client side, on core's people: each person's
// membership, a chip to filter and group by; the people collection's
// New form, an invitation and its link; and on a person's page where
// they stand as a member, a panel of their overview, and their
// membership in its Membership tab: the steps joining asks, and
// what a member owns and decides, which the grafts joining membership
// fill beside the feat's own.
export const app: App = {
  name: 'membership',
  extends: {
    people: {
      columns: [
        { key: 'member', label: 'Member', kind: 'badge', role: 'hidden', value: (r: Row) => r.member ?? '', tone: (r: Row) => (r.status ? tones[r.status] : 'neutral') },
        { key: 'shares', label: 'Shares', kind: 'number', role: 'hidden', value: (r: Row) => r.shares },
        { key: 'since', label: 'Member since', kind: 'date', role: 'hidden', value: (r: Row) => r.since },
      ],
      create: Invite,
      title: 'Invite to join',
      page: {
        properties: ({ member: m, first: f }: Membership) => [
          ...(m
            ? [
                { label: 'Member', value: chips[m.status], kind: 'badge' as const, tone: tones[m.status] },
                { label: 'Invited', value: m.invited, kind: 'date' as const },
                { label: 'Member since', value: m.since, kind: 'date' as const },
                ...(m.suspended ? [{ label: 'Suspended', value: m.suspended, kind: 'date' as const }] : []),
                ...(m.exited ? [{ label: 'Exited', value: m.exited, kind: 'date' as const }] : []),
              ]
            : []),
          ...(f
            ? [
                { label: 'First device', value: `${f.label} · ${short(f.key, 12)}`, kind: 'mono' as const, glyph: icons.DeviceMobile, lead: 'first device' },
                { label: 'Took up', value: f.accepted, kind: 'date' as const, lead: 'took up the invite' },
              ]
            : []),
        ],
        blocks: [
          Standing,
          { tab: 'membership', block: Joining },
          { tab: 'membership', block: Device },
          { tab: 'membership', block: Rights },
          { tab: 'membership', block: Withdraw },
          { tab: 'membership', block: Erase },
        ],
      },
    },
  },
}
export * as seats from './seats.ts'
