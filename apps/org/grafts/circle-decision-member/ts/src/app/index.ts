import type { App } from '@cella/org-ui'
import { outcome, type Roll } from '../models/roll.ts'
import Electorate from './blocks/Electorate.svelte'

// The graft's client side: a decision's roll, each member's stance and
// its outcome, and the form a member on the roll casts their stance with.
export const app: App = {
  name: 'circle-decision-member',
  extends: {
    decisions: {
      columns: [{ key: 'turnout', label: 'Stances', role: 'hidden', value: (r: { turnout?: string }) => r.turnout }],
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
