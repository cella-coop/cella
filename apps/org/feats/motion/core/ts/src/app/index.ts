import { icons, type App } from '@cella/org-ui'
import { terms, type Motion, type Detail } from '../models/motion.ts'
import Close from './blocks/Close.svelte'
import Create from './blocks/Create.svelte'
import Discussion from './blocks/Discussion.svelte'
import Effects from './blocks/Effects.svelte'
import Proposal from './blocks/Proposal.svelte'

// The feat's client side: the motions, open first, a new one with what
// it decides, and a motion's page with its proposal, the stances given
// and its close, with what it does and what the close carried.
export const app: App = {
  name: 'motion',
  collections: {
    motions: {
      view: {
        title: 'Motions',
        icon: icons.Scales,
        create: Create,
        columns: [
          { key: 'title', label: 'Motion', kind: 'title', role: 'title', value: (d: Motion) => d.title },
          { key: 'id', label: 'Id', kind: 'mono', role: 'sub', value: (d: Motion) => d.id },
          { key: 'circle', label: 'Circle', kind: 'circle', role: 'meta', value: (d: Motion) => d.circle },
          { key: 'method', label: 'Method', role: 'hidden', value: (d: Motion) => d.method },
          { key: 'procedure', label: 'Procedure', kind: 'badge', role: 'hidden', value: (d: Motion) => d.procedure },
          { key: 'deadline', label: 'Deadline', kind: 'date', role: 'meta', value: (d: Motion) => d.deadline },
        ],
      },
      page: {
        eyebrow: 'Motion',
        title: (d: Detail) => d.title,
        subtitle: (d: Detail) => d.id,
        properties: (d: Detail) => [
          { label: 'Procedure', value: d.terms.label },
          ...(terms(d.terms) === d.terms.label.toLowerCase() ? [] : [{ label: 'Terms', value: terms(d.terms) }]),
          { label: 'Circle', value: d.circleName, href: `/circles/${d.circle}` },
          { label: 'Put by', value: d.authorName, href: `/circles/${d.authorCircle}` },
          { label: 'Proposed', value: d.proposed, kind: 'date' },
          { label: 'Deadline', value: d.deadline, kind: 'date' },
          { label: 'Closed', value: d.closed, kind: 'date' },
          { label: 'Cutoff', value: d.cutoff === null ? null : `receipt ${d.cutoff}`, kind: 'mono' },
        ],
        related: (d: Detail) => [{ label: d.circleName, sub: 'circle', href: `/circles/${d.circle}` }],
        activity: (d: Detail) => d.given.map((g) => ({ at: g.at, who: g.member, text: `${g.stance}, receipt ${g.receipt}` })),
        // The motion itself, what is proposed, and then the data central to
        // it, each its own view: who stands where on it, what its members
        // say about it, and what it does, to the mandates and at its close.
        tabs: [
          { id: 'overview', label: 'Overview' },
          { id: 'stances', label: 'Stances' },
          { id: 'discussion', label: 'Discussion' },
          { id: 'effects', label: 'Effects' },
        ],
        blocks: [Proposal, { tab: 'discussion', block: Discussion }, { tab: 'effects', block: Effects }],
        actions: Close,
      },
    },
  },
}
export * as circles from './circles.ts'
