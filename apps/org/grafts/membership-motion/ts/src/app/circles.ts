import { icons, type App, type Tone } from '@cella/org-ui'
import { outcome, states, type Roll, type State } from '../models/roll.ts'
import type { Standing } from '../models/asking.ts'
import Appoint from './blocks/Appoint.svelte'
import Terms from './blocks/Terms.svelte'
import Roles from './blocks/Roles.svelte'
import Electorate from './blocks/Electorate.svelte'
import Membership from './blocks/Membership.svelte'
import Outcome from './blocks/Outcome.svelte'
import Organization from './blocks/Organization.svelte'
import Features from './blocks/Features.svelte'

const tones: Record<State, Tone> = { open: 'accent', passed: 'positive', rejected: 'negative' }

// The graft's client side: each motion's state, open, passed or
// rejected, its views and its board, on which dragging an open motion
// into Passed or Rejected is its close; a motion's roll, each member's
// stance and its outcome, and the form a member on the roll casts their
// stance with; a circle's Settings tab, its terms and its roles, which a
// motion amends and makes, and its features page in Settings; and
// Settings' Organization page, the co-op's
// particulars, which a motion of the assembly replaces.
export const app: App = {
  name: 'membership-motion/circles',
  extends: {
    motions: {
      columns: [
        { key: 'turnout', label: 'Stances', role: 'hidden', value: (r: { turnout?: string }) => r.turnout },
        {
          key: 'state',
          label: 'State',
          kind: 'badge',
          role: 'meta',
          value: (r: { state?: State }) => r.state,
          tone: (r: { state?: State }) => (r.state ? tones[r.state] : 'neutral'),
        },
      ],
      look: { layout: 'board', by: 'state', lanes: { state: [...states] }, cards: ['circleName', 'deadline', 'turnout'] },
      // The close freezes which stances counted; whether it passed is the
      // database's, so Passed and Rejected both take the drop.
      shifts: [{ by: 'state', from: ['open'], to: ['passed', 'rejected'], action: 'close' }],
      page: {
        properties: (r: Roll) => [
          { label: 'State', value: r.state, kind: 'badge', tone: tones[r.state] },
          { label: 'Outcome', value: outcome(r, true).text, kind: 'badge', tone: outcome(r).tone },
          { label: 'On the roll', value: r.voters.length, kind: 'number' },
        ],
        blocks: [Outcome, { tab: 'stances', block: Electorate }],
      },
    },
    people: {
      page: {
        related: (s: Standing | null) => (s?.open ?? []).map((o) => ({ label: o.title, sub: `open until ${o.deadline}`, href: `/motions/${o.motion}` })),
        actions: Membership,
      },
    },
    circles: {
      page: {
        actions: Appoint,
        tabs: [{ id: 'settings', label: 'Settings' }],
        blocks: [
          { tab: 'settings', block: Terms },
          { tab: 'settings', block: Roles },
        ],
      },
    },
  },
  // The co-op's own settings, first under Organization: its particulars,
  // which the assembly's motion replaces, and the scope's address and
  // timezone, which a host sets.
  settings: {
    organization: {
      subgroup: 'Organization',
      title: 'Organization',
      caption: 'What the co-op is called and what its papers print, which a motion of the assembly changes.',
      icon: icons.Buildings,
      block: Organization,
    },
    // A circle's features, a page of the circle, `/settings/features/<id>`,
    // which its Settings tab links to, so the sidebar lists it nowhere.
    features: {
      subgroup: 'Organization',
      title: 'Features',
      caption: "What the circle shows in the sidebar, in its order, which a motion of the circle that decides about it changes.",
      icon: icons.SquaresFour,
      listed: false,
      block: Features,
    },
  },
}
