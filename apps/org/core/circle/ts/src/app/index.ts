import { icons, power, type App } from '@cella/org-ui'
import type { Circle, Detail, Standing, Provenance } from '../models/circle.ts'
import Chain from './blocks/Chain.svelte'
import Structure from './blocks/Structure.svelte'
import { cap, covers, tones } from './words.ts'

export { cap } from './words.ts'

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
        group: 'governance',
        title: 'Circles',
        icon: icons.CirclesThree,
        look: { layout: 'gallery', cards: ['purpose', 'procedure'] },
        columns: [
          { key: 'name', label: 'Circle', kind: 'title', role: 'title', value: (c: Circle) => c.name },
          { key: 'purpose', label: 'Purpose', role: 'sub', value: (c: Circle) => c.purpose },
          { key: 'procedure', label: 'Decides by', kind: 'badge', role: 'meta', value: (c: Circle) => c.procedure },
        ],
      },
      page: {
        eyebrow: 'Circle',
        title: (c: Detail) => c.name,
        subtitle: (c: Detail) => c.id,
        summary: (c: Detail) => c.purpose,
        properties: (c: Detail) => [
          { label: 'Id', value: c.id, kind: 'mono' },
          ...(c.assembly ? [{ label: 'The assembly', value: 'holds every power' }] : []),
          { label: 'Decides by', value: c.procedure, kind: 'badge' },
          { label: 'Roles', value: c.roles.length, kind: 'number' },
        ],
        related: (c: Detail) => [
          ...c.issuers.map((k) => ({ label: k.name, sub: 'issued its mandates', href: `/circles/${k.id}` })),
          ...c.issued.map((k) => ({ label: k.name, sub: 'holds mandates it issued', href: `/circles/${k.id}` })),
        ],
        // Its purpose first, then its roles and their mandates in a tab of
        // their own; its seats and policies are the tabs its extenders add.
        tabs: [
          { id: 'overview', label: 'Overview' },
          { id: 'roles', label: 'Roles' },
        ],
        blocks: [{ tab: 'roles', block: Structure }],
      },
    },
    mandates: {
      view: {
        group: 'governance',
        title: 'Mandates',
        caption: 'Each grant of a power, issued down from the assembly',
        icon: icons.TreeStructure,
        columns: [
          { key: 'power', label: 'Power', kind: 'title', role: 'title', value: (m: Standing) => power(m.power) },
          { key: 'granteeName', label: 'Granted to', role: 'sub', value: (m: Standing) => m.granteeName },
          { key: 'cap', label: 'Cap', value: (m: Standing) => cap(m) },
          { key: 'scope', label: 'Covers', value: (m: Standing) => covers(m) },
          { key: 'issuerName', label: 'Issued by', value: (m: Standing) => m.issuerName },
          { key: 'state', label: 'State', kind: 'badge', role: 'meta', value: (m: Standing) => m.state, tone: (m: Standing) => tones[m.state] },
        ],
      },
      page: {
        eyebrow: 'Mandate',
        title: (m: Provenance) => `${power(m.power)}, to ${m.granteeName}`,
        subtitle: (m: Provenance) => m.sentence,
        properties: (m: Provenance) => [
          { label: 'State', value: m.state, kind: 'badge', tone: tones[m.state] },
          { label: 'Since', value: m.since, kind: 'date' },
          { label: 'Power', value: m.power, kind: 'mono' },
          { label: 'Granted to', value: m.granteeName, ...(m.circle ? { href: `/circles/${m.circle}` } : {}) },
          ...(m.limit !== null
            ? [{ label: 'Limit a write', value: m.limit, kind: 'money' as const }]
            : m.budget !== null
              ? [{ label: `Budget a ${m.per}`, value: m.budget, kind: 'money' as const }]
              : [{ label: 'Cap', value: 'uncapped' }]),
          { label: 'Covers', value: covers(m) },
          { label: 'From', value: m.from, kind: 'date' },
          ...(m.until ? [{ label: 'Until', value: m.until, kind: 'date' as const }] : []),
          ...(m.procedure ? [{ label: 'Decided by', value: m.procedure, kind: 'badge' as const }] : []),
          { label: 'Issued by', value: m.issuerName, href: `/circles/${m.issuer}` },
          ...(m.motion ? [{ label: 'Adopted by', value: m.motion, kind: 'mono' as const, href: `/motions/${m.motion}` }] : []),
        ],
        blocks: [Chain],
      },
    },
  },
}
