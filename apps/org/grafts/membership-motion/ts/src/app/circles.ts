import { icons, type App, type Tone } from '@cella/org-ui'
import { outcome, states, taking, type Roll, type State } from '../models/roll.ts'
import type { Featuring, Organization as Organized, Ruling, Standing } from '../models/asking.ts'
import Appoint from './blocks/Appoint.svelte'
import Terms from './blocks/Terms.svelte'
import Roles from './blocks/Roles.svelte'
import Electorate from './blocks/Electorate.svelte'
import Membership from './blocks/Membership.svelte'
import Changes from './blocks/Changes.svelte'
import Organization from './blocks/Organization.svelte'
import Features from './blocks/Features.svelte'
import Rules from './blocks/Rules.svelte'

const tones: Record<State, Tone> = { open: 'accent', passed: 'positive', rejected: 'negative' }

// The graft's client side: each motion's state, open, passed or
// rejected, its views and its board, on which dragging an open motion
// into Passed or Rejected is its close; a motion's roll, each member's
// stance and its outcome, and the form a member on the roll casts their
// stance with; a circle's Settings tab, its terms and its roles, which a
// motion amends and makes, and its features page in Settings; and
// Settings' Organization page, the coop's
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
      // A list by circle, each motion's state a chip on its row (the
      // operator, 20 Nov); as a board, its columns are the states, a
      // swimlane for each circle, as the project and task boards declare
      // theirs.
      look: { layout: 'list', by: 'circle', columns: 'state', lanes: { state: [...states] }, cards: ['circle', 'deadline', 'turnout'] },
      // The close freezes which stances counted; whether it passed is the
      // database's, so Passed and Rejected both take the drop.
      shifts: [{ by: 'state', from: ['open'], to: ['passed', 'rejected'], action: 'close' }],
      page: {
        properties: (r: Roll) => [
          { label: 'State', value: r.state, kind: 'badge', tone: tones[r.state] },
          { label: 'Outcome', value: outcome(r, true).text, kind: 'badge', tone: outcome(r).tone },
          { label: 'Turnout', value: taking(r) },
        ],
        // What its actions change, as their diffs, on its Overview and its
        // Effects.
        blocks: [Changes, { tab: 'stances', block: Electorate }, { tab: 'effects', block: Changes }],
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
        blocks: [
          { tab: 'settings', block: Terms },
          { tab: 'settings', block: Roles },
        ],
      },
    },
  },
  // The coop's own settings, first under Organization: its particulars,
  // which the assembly's motion replaces, and in its Details the scope's
  // address and timezone, which a host sets, never a motion.
  settings: {
    organization: {
      subgroup: 'Organization',
      title: 'Organization',
      caption: 'What the coop is called and what its papers print, which a motion of the assembly changes.',
      icon: icons.Buildings,
      block: Organization,
      properties: (d: Organized) => [
        { label: 'Address', lead: 'address', value: d.scope ?? 'Unset', group: 'Set by a host' },
        { label: 'Timezone', lead: 'timezone', value: d.timezone ?? 'UTC', group: 'Set by a host' },
      ],
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
      properties: (d: Featuring) => [{ label: 'Circle', lead: 'of', value: d.name, href: `/circles/${d.circle}` }],
    },
    // A circle's rules, a page of the circle, `/settings/rules/<id>`,
    // which its Settings tab links to beside its features.
    rules: {
      subgroup: 'Organization',
      title: 'Rules',
      caption: 'What the circle sets for itself, as whether its comments take reactions, each by a rule a motion adopts.',
      icon: icons.Scales,
      listed: false,
      block: Rules,
      properties: (d: Ruling) => [{ label: 'Circle', lead: 'of', value: d.name, href: `/circles/${d.circle}` }],
    },
  },
}
