import { icons, type App } from '@cella/org-ui'
import { terms, type Motion, type Detail } from '../models/motion.ts'
import Close from './blocks/Close.svelte'
import Create from './blocks/Create.svelte'
import Discussion from './blocks/Discussion.svelte'
import Effects from './blocks/Effects.svelte'
import Proposal from './blocks/Proposal.svelte'
import Vote from './blocks/Vote.svelte'

// The feat's client side: the motions, open first, a new one with what
// it decides, and a motion's page with its proposal and then its Vote widget,
// the stances given and its close, with what it does
// and what the close carried; its deliberation is the shared thread
// under its Overview, not a tab of its own.
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
          { key: 'id', label: 'Id', kind: 'mono', role: 'hidden', value: (d: Motion) => d.id },
          { key: 'circle', label: 'Circle', kind: 'circle', role: 'meta', value: (d: Motion) => d.circle },
          { key: 'method', label: 'Method', role: 'hidden', value: (d: Motion) => d.method },
          { key: 'procedure', label: 'Procedure', kind: 'badge', role: 'hidden', value: (d: Motion) => d.procedure },
          { key: 'deadline', label: 'Deadline', kind: 'date', role: 'meta', value: (d: Motion) => d.deadline },
        ],
        // By circle, the nearest deadline first; membership-motion's state
        // makes it a board.
        look: { by: 'circle', sort: { field: 'deadline', dir: 'asc' } },
      },
      page: {
        eyebrow: 'Motion',
        title: (d: Detail) => d.title,
        subtitle: (d: Detail) => d.id,
        // Its deadline and its close are the Vote panel's header's, so the
        // drawer leaves them out.
        properties: (d: Detail) => [
          { label: 'Procedure', value: `${d.terms.label.charAt(0).toLowerCase()}${d.terms.label.slice(1)}`, glyph: icons.Scales, lead: 'by' },
          ...(terms(d.terms) === d.terms.label.toLowerCase() ? [] : [{ label: 'Terms', value: terms(d.terms), glyph: icons.ListChecks, lead: 'needs' }]),
          { label: 'Circle', value: d.circleName, href: `/circles/${d.circle}` },
          { label: 'Put by', value: d.authorName, href: `/circles/${d.authorCircle}`, lead: 'put by' },
          { label: 'Proposed', value: d.proposed, kind: 'date' },
          { label: 'Cutoff', value: d.cutoff === null ? null : `receipt ${d.cutoff}`, kind: 'mono', lead: 'counted to' },
        ],
        related: (d: Detail) => [{ label: d.circleName, sub: 'circle', href: `/circles/${d.circle}` }],
        activity: (d: Detail) => d.given.map((g) => ({ at: g.at, who: g.member, text: `${g.stance}, receipt ${g.receipt}` })),
        // The motion itself, what is proposed, and then the data central to
        // it, each its own view: who stands where on it, what its members
        // say about it, and what it does, to the mandates and at its close.
        tabs: [
          { id: 'overview', label: 'Overview' },
          { id: 'stances', label: 'Stances' },
          { id: 'effects', label: 'Effects' },
        ],
        layout: 'body',
        body: Proposal,
        blocks: [Vote, { tab: 'effects', block: Effects }],
        // The deliberation, under the Activity like any record's.
        comment: Discussion,
        actions: Close,
      },
    },
  },
}
export * as circles from './circles.ts'
