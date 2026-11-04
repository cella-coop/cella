import type { App, Tone } from '@cella/org-ui'
import { outcome, states, type Roll, type State } from '../models/roll.ts'
import type { Standing } from '../models/asking.ts'
import Appoint from './blocks/Appoint.svelte'
import Electorate from './blocks/Electorate.svelte'
import Membership from './blocks/Membership.svelte'
import Outcome from './blocks/Outcome.svelte'

const tones: Record<State, Tone> = { open: 'accent', passed: 'positive', rejected: 'negative' }

// The graft's client side: each motion's state, open, passed or
// rejected, its views and its board, on which dragging an open motion
// into Passed or Rejected is its close; a motion's roll, each member's
// stance and its outcome, and the form a member on the roll casts their
// stance with.
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
      look: { layout: 'board', by: 'state', lanes: { state: [...states] }, cards: ['circle', 'deadline', 'turnout'] },
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
      page: { actions: Appoint },
    },
  },
}
