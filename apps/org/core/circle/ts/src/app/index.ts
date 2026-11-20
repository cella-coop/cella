import { icons, power, recordIcon, recordIcons, type App } from '@cella/org-ui'
import type { Circle, Detail, Standing, Provenance } from '../models/circle.ts'
import Chain from './blocks/Chain.svelte'
import Roles from './blocks/Roles.svelte'
import Structure from './blocks/Structure.svelte'
import View from './blocks/View.svelte'
import { cap, covers, tones } from '../bindings/words.ts'

// The feat's client side: the circles, none within another, and a
// circle's page with its roles, the mandates granted to them, and the
// circles the mandates link it to; and the mandates, a mandate's page
// showing the chain it was issued down from the assembly, and what was
// issued under it.
export const app: App = {
  name: 'circle',
  collections: {
    circles: {
      view: {
        title: 'Circles',
        // A group, as each circle is; a person wears one person.
        icon: icons.Users,
        look: { layout: 'gallery', cards: ['purpose'] },
        columns: [
          { key: 'name', label: 'Circle', kind: 'title', role: 'title', value: (c: Circle) => c.name },
          { key: 'purpose', label: 'Purpose', role: 'sub', value: (c: Circle) => c.purpose },
          { key: 'procedure', label: 'Decides by', kind: 'badge', role: 'meta', value: (c: Circle) => c.procedure },
        ],
      },
      page: {
        eyebrow: 'Circle',
        actions: View,
        title: (c: Detail) => c.name,
        subtitle: (c: Detail) => c.id,
        summary: (c: Detail) => c.purpose,
        properties: (c: Detail) => [
          { label: 'Icon', value: recordIcons.find((i) => i.slug === c.icon)?.name ?? null, icon: recordIcon(c.icon), ink: c.name, edit: { kind: 'icon' as const, write: 'icon', field: 'icon', current: c.icon } },
          // Its id is the reference under its title.
          ...(c.assembly ? [{ label: 'The assembly holds every power', value: 'the assembly', kind: 'badge' as const, tone: 'accent' as const }] : []),
          { label: 'Decides by', value: c.procedure, glyph: icons.Scales, lead: 'decides by' },
        ],
        related: (c: Detail) => [
          ...c.issuers.map((k) => ({ label: k.name, sub: 'issued its mandates', href: `/circles/${k.id}` })),
          ...c.issued.map((k) => ({ label: k.name, sub: 'holds mandates it issued', href: `/circles/${k.id}` })),
        ],
        // Its purpose first, then its roles and their mandates, with the
        // seats membership fills them by; the policies in force, and its
        // settings, its terms and the roles a motion makes, which the
        // extenders fill.
        tabs: [
          { id: 'overview', label: 'Overview' },
          { id: 'roles', label: 'Roles' },
          { id: 'policies', label: 'Policies' },
          { id: 'settings', label: 'Settings' },
        ],
        // A circle keeps no body; its overview is its purpose, then its
        // roles summarised.
        layout: 'panels',
        blocks: [Roles, { tab: 'roles', block: Structure }],
      },
    },
    mandates: {
      view: {
        title: 'Mandates',
        caption: 'Each grant of a power, issued down from the assembly',
        icon: icons.TreeStructure,
        columns: [
          { key: 'power', label: 'Power', kind: 'title', role: 'title', value: (m: Standing) => power(m.power) },
          // A circle granted one wears its icon, in the row and in the
          // group's header; a role every circle has, the circles' own.
          { key: 'granteeName', label: 'Granted to', kind: 'circle', role: 'sub', value: (m: Standing) => (m.grantee === m.circle ? m.grantee : m.granteeName) },
          { key: 'cap', label: 'Cap', role: 'meta', value: (m: Standing) => cap(m) },
          { key: 'scope', label: 'Covers', value: (m: Standing) => covers(m) },
          { key: 'issuer', label: 'Issued by', kind: 'circle', role: 'meta', value: (m: Standing) => m.issuer },
          { key: 'state', label: 'State', kind: 'badge', role: 'meta', value: (m: Standing) => m.state, tone: (m: Standing) => tones[m.state] },
        ],
        // Read by who holds them: grouped by whom each is granted to, the
        // circle that issued it a chip on its row (the operator, 20 Nov).
        look: { by: 'granteeName', sort: { field: 'power', dir: 'asc' } },
      },
      page: {
        eyebrow: 'Mandate',
        title: (m: Provenance) => `${power(m.power)}, to ${m.granteeName}`,

        // Its power is its title's; its state's day only where it is not
        // the day it starts.
        properties: (m: Provenance) => [
          { label: 'State', value: m.state, kind: 'badge', tone: tones[m.state] },
          ...(String(m.since).slice(0, 10) === String(m.from).slice(0, 10) ? [] : [{ label: 'Since', value: m.since, kind: 'date' as const, lead: `${m.state} since` }]),
          { label: 'Granted to', value: m.granteeName, lead: 'to', ...(m.circle ? { href: `/circles/${m.circle}` } : {}) },
          // Its cap in words, as the chain says it: a figure alone would
          // not say what it bounds.
          { label: 'Cap', value: cap(m), glyph: icons.Wallet },
          { label: 'Covers', value: covers(m), glyph: icons.CirclesThree, lead: 'covers' },
          { label: 'From', value: m.from, kind: 'date' },
          ...(m.until ? [{ label: 'Until', value: m.until, kind: 'date' as const }] : []),
          ...(m.procedure ? [{ label: 'Decided by', value: m.procedure, glyph: icons.Scales, lead: 'decided by' }] : []),
          { label: 'Issued by', value: m.issuerName, href: `/circles/${m.issuer}`, lead: 'issued by' },
        ],
        layout: 'panels',
        blocks: [Chain],
      },
    },
  },
}
