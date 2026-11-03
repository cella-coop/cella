import { icons, type App } from '@cella/org-ui'
import type { Circle, Detail } from '../models/circle.ts'
import Structure from './blocks/Structure.svelte'

// The feat's client side: the circles, none within another, and a
// circle's page with its roles, the mandates granted to them, and the
// circles the mandates link it to.
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
        subtitle: (c: Detail) => c.purpose,
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
        blocks: [Structure],
      },
    },
  },
}
