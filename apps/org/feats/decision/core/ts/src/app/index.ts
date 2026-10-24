import { icons, type App } from '@cella/org-ui'
import type { Decision, Detail } from '../models/decision.ts'
import Close from './blocks/Close.svelte'
import Proposal from './blocks/Proposal.svelte'

// The feat's client side: the decisions, open first, and a decision's page
// with its proposal, the stances given and its close.
export const app: App = {
  name: 'decision',
  collections: {
    decisions: {
      view: {
        group: 'governance',
        title: 'Decisions',
        icon: icons.Scales,
        columns: [
          { key: 'title', label: 'Decision', kind: 'title', role: 'title', value: (d: Decision) => d.title },
          { key: 'id', label: 'Id', kind: 'mono', role: 'sub', value: (d: Decision) => d.id },
          { key: 'circle', label: 'Circle', kind: 'mono', role: 'meta', value: (d: Decision) => d.circle },
          { key: 'rule', label: 'Rule', role: 'hidden', value: (d: Decision) => d.rule },
          { key: 'deadline', label: 'Deadline', kind: 'date', role: 'meta', value: (d: Decision) => d.deadline },
          {
            key: 'state',
            label: 'State',
            kind: 'badge',
            role: 'meta',
            value: (d: Decision) => (d.closed ? 'closed' : 'open'),
            tone: (d: Decision) => (d.closed ? 'neutral' : 'accent'),
          },
        ],
      },
      page: {
        eyebrow: 'Decision',
        title: (d: Detail) => d.title,
        subtitle: (d: Detail) => `${d.id} · by ${d.rule} in ${d.circle}`,
        properties: (d: Detail) => [
          { label: 'State', value: d.closed ? 'closed' : 'open', kind: 'badge', tone: d.closed ? 'neutral' : 'accent' },
          { label: 'Rule', value: d.rule },
          { label: 'Circle', value: d.circle, href: `/circles/${d.circle}` },
          { label: 'Proposed', value: d.proposed, kind: 'date' },
          { label: 'Deadline', value: d.deadline, kind: 'date' },
          { label: 'Closed', value: d.closed, kind: 'date' },
          { label: 'Cutoff', value: d.cutoff === null ? null : `receipt ${d.cutoff}`, kind: 'mono' },
        ],
        related: (d: Detail) => [{ label: d.circle, sub: 'circle', href: `/circles/${d.circle}` }],
        activity: (d: Detail) => d.given.map((g) => ({ at: g.at, who: g.member.split('@')[0], text: `${g.stance}, receipt ${g.receipt}` })),
        blocks: [Proposal],
        actions: Close,
      },
    },
  },
}
