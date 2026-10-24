import type { App, Tone } from '@cella/org-ui'
import { outcome, standings, type Roll, type Standing } from '../models/roll.ts'
import Electorate from './blocks/Electorate.svelte'

const tones: Record<Standing, Tone> = { open: 'accent', 'closed and passed': 'positive', 'closed and failed': 'negative' }

// The graft's client side: where each decision stands, as a board by
// default, on which dragging an open decision into a closed column is its
// close; a decision's roll, each member's stance and its outcome, and the
// form a member on the roll casts their stance with.
export const app: App = {
  name: 'circle-decision-member',
  extends: {
    decisions: {
      columns: [
        { key: 'turnout', label: 'Stances', role: 'hidden', value: (r: { turnout?: string }) => r.turnout },
        {
          key: 'standing',
          label: 'Standing',
          kind: 'badge',
          role: 'hidden',
          value: (r: { standing?: Standing }) => r.standing,
          tone: (r: { standing?: Standing }) => (r.standing ? tones[r.standing] : 'neutral'),
        },
      ],
      look: { layout: 'board', by: 'standing', lanes: { standing: [...standings] }, cards: ['circle', 'deadline', 'turnout'] },
      // The close fixes which stances counted; whether it passed is the
      // database's, so either closed column takes the drop.
      shifts: [{ by: 'standing', from: ['open'], to: ['closed and passed', 'closed and failed'], action: 'close' }],
      page: {
        properties: (r: Roll) => [
          { label: 'Outcome', value: outcome(r).text, kind: 'badge', tone: outcome(r).tone },
          { label: 'On the roll', value: r.voters.length, kind: 'number' },
        ],
        blocks: [Electorate],
      },
    },
  },
}
