import { icons, type App } from '@cella/org-ui'
import { terms, type Motion, type Detail } from '../models/motion.ts'
import Close from './blocks/Close.svelte'
import Create from './blocks/Create.svelte'
import Discussion from './blocks/Discussion.svelte'
import Effects from './blocks/Effects.svelte'
import Proposal from './blocks/Proposal.svelte'

// The motion card, which the grafts that draw a motion elsewhere embed.
export { default as Card } from './blocks/Card.svelte'

// The feat's client side: the motions, open first, a new one with what
// it decides, and a motion's page with its proposal, the stances given
// and its close, with what the close carried.
export const app: App = {
  name: 'motion',
  collections: {
    motions: {
      view: {
        group: 'governance',
        title: 'Motions',
        icon: icons.Scales,
        create: Create,
        columns: [
          { key: 'title', label: 'Motion', kind: 'title', role: 'title', value: (d: Motion) => d.title },
          { key: 'id', label: 'Id', kind: 'mono', role: 'sub', value: (d: Motion) => d.id },
          { key: 'circle', label: 'Circle', kind: 'mono', role: 'meta', value: (d: Motion) => d.circle },
          { key: 'method', label: 'Method', role: 'hidden', value: (d: Motion) => d.method },
          { key: 'procedure', label: 'Procedure', kind: 'badge', role: 'hidden', value: (d: Motion) => d.procedure },
          { key: 'deadline', label: 'Deadline', kind: 'date', role: 'meta', value: (d: Motion) => d.deadline },
        ],
      },
      page: {
        eyebrow: 'Motion',
        title: (d: Detail) => d.title,
        subtitle: (d: Detail) => `${d.id} · by ${d.terms.label.toLowerCase()} in ${d.circle}`,
        properties: (d: Detail) => [
          { label: 'Procedure', value: d.terms.label },
          ...(terms(d.terms) === d.terms.label.toLowerCase() ? [] : [{ label: 'Terms', value: terms(d.terms) }]),
          { label: 'Circle', value: d.circle, href: `/circles/${d.circle}` },
          { label: 'Proposed', value: d.proposed, kind: 'date' },
          { label: 'Deadline', value: d.deadline, kind: 'date' },
          { label: 'Closed', value: d.closed, kind: 'date' },
          { label: 'Cutoff', value: d.cutoff === null ? null : `receipt ${d.cutoff}`, kind: 'mono' },
        ],
        related: (d: Detail) => [{ label: d.circle, sub: 'circle', href: `/circles/${d.circle}` }],
        activity: (d: Detail) => d.given.map((g) => ({ at: g.at, who: g.member, text: `${g.stance}, receipt ${g.receipt}` })),
        // The motion itself, who stands where on it, and what its members
        // say about it: the roll and the deliberation are the two views the
        // overview does not already give.
        tabs: [
          { id: 'overview', label: 'Overview' },
          { id: 'stances', label: 'Stances' },
          { id: 'discussion', label: 'Discussion' },
        ],
        blocks: [Proposal, Effects, { tab: 'discussion', block: Discussion }],
        actions: Close,
      },
    },
  },
}
export * as circles from './circles.ts'
