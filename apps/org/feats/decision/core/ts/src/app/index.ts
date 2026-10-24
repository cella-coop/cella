import { icons, type App } from '@cella/org-ui'
import type { Decision, Detail } from '../models/decision.ts'
import Close from './blocks/Close.svelte'
import Create from './blocks/Create.svelte'
import Proposal from './blocks/Proposal.svelte'

// The decision card, which the grafts that draw a decision elsewhere embed.
export { default as Card } from './blocks/Card.svelte'

// The feat's client side: the decisions, open first, a new one with what
// it decides, and a decision's page with its proposal, the stances given
// and its close.
export const app: App = {
  name: 'decision',
  collections: {
    decisions: {
      view: {
        group: 'governance',
        title: 'Decisions',
        icon: icons.Scales,
        create: Create,
        columns: [
          { key: 'title', label: 'Decision', kind: 'title', role: 'title', value: (d: Decision) => d.title },
          { key: 'id', label: 'Id', kind: 'mono', role: 'sub', value: (d: Decision) => d.id },
          { key: 'circle', label: 'Circle', kind: 'mono', role: 'meta', value: (d: Decision) => d.circle },
          { key: 'rule', label: 'Rule', role: 'hidden', value: (d: Decision) => d.rule },
          { key: 'deadline', label: 'Deadline', kind: 'date', role: 'meta', value: (d: Decision) => d.deadline },
        ],
      },
      page: {
        eyebrow: 'Decision',
        title: (d: Detail) => d.title,
        subtitle: (d: Detail) => `${d.id} · by ${d.rule} in ${d.circle}`,
        properties: (d: Detail) => [
          { label: 'Rule', value: d.rule },
          { label: 'Circle', value: d.circle, href: `/circles/${d.circle}` },
          { label: 'Proposed', value: d.proposed, kind: 'date' },
          { label: 'Deadline', value: d.deadline, kind: 'date' },
          { label: 'Closed', value: d.closed, kind: 'date' },
          { label: 'Cutoff', value: d.cutoff === null ? null : `receipt ${d.cutoff}`, kind: 'mono' },
        ],
        related: (d: Detail) => [{ label: d.circle, sub: 'circle', href: `/circles/${d.circle}` }],
        activity: (d: Detail) => d.given.map((g) => ({ at: g.at, who: g.member.split('@')[0], text: `${g.stance}, receipt ${g.receipt}` })),
        // The decision itself, and who stands where on it: the roll is the
        // one view the overview does not already give.
        tabs: [
          { id: 'overview', label: 'Overview' },
          { id: 'stances', label: 'Stances' },
        ],
        blocks: [Proposal],
        actions: Close,
      },
    },
  },
}
