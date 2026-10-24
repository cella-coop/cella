import type { App, Tone } from '@cella/org-ui'
import { outcome, states, type Roll, type State } from '../models/roll.ts'
import Electorate from './blocks/Electorate.svelte'

const tones: Record<State, Tone> = { open: 'accent', passed: 'positive', rejected: 'negative' }

// The graft's client side: each decision's state, open, passed or
// rejected, its views and its board, on which dragging an open decision
// into Passed or Rejected is its close; a decision's roll, each member's
// stance and its outcome, and the form a member on the roll casts their
// stance with.
export const app: App = {
  name: 'circle-decision-member',
  extends: {
    decisions: {
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
      views: [
        { id: 'open', name: 'Open', icon: 'open', where: [{ field: 'state', is: ['open'] }] },
        { id: 'passed', name: 'Passed', icon: 'done', where: [{ field: 'state', is: ['passed'] }] },
        { id: 'rejected', name: 'Rejected', icon: 'warning', where: [{ field: 'state', is: ['rejected'] }] },
      ],
      look: { layout: 'board', by: 'state', lanes: { state: [...states] }, cards: ['circle', 'deadline', 'turnout'] },
      // The close freezes which stances counted; whether it passed is the
      // database's, so Passed and Rejected both take the drop.
      shifts: [{ by: 'state', from: ['open'], to: ['passed', 'rejected'], action: 'close' }],
      page: {
        properties: (r: Roll) => [
          { label: 'State', value: r.state, kind: 'badge', tone: tones[r.state] },
          { label: 'Outcome', value: outcome(r).text, kind: 'badge', tone: outcome(r).tone },
          { label: 'On the roll', value: r.voters.length, kind: 'number' },
        ],
        blocks: [Electorate],
      },
    },
  },
}
