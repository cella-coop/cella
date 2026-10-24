import { icons, type App } from '@cella/org-ui'
import type { Circle, Detail } from '../models/circle.ts'
import Structure from './blocks/Structure.svelte'

// The feat's client side: the circles, in their tree, and a circle's page
// with its roles and the mandates granted to them.
export const app: App = {
  name: 'circle',
  collections: {
    circles: {
      view: {
        group: 'governance',
        title: 'Circles',
        icon: icons.CirclesThree,
        look: { layout: 'gallery', cards: ['purpose', 'parent'] },
        columns: [
          { key: 'name', label: 'Circle', kind: 'title', role: 'title', value: (c: Circle) => c.name },
          { key: 'purpose', label: 'Purpose', role: 'sub', value: (c: Circle) => c.purpose },
          { key: 'parent', label: 'Within', kind: 'mono', role: 'meta', value: (c: Circle) => c.parent },
          { key: 'procedure', label: 'Decides by', kind: 'badge', role: 'meta', value: (c: Circle) => c.procedure },
        ],
      },
      page: {
        eyebrow: 'Circle',
        title: (c: Detail) => c.name,
        subtitle: (c: Detail) => c.purpose,
        properties: (c: Detail) => [
          { label: 'Id', value: c.id, kind: 'mono' },
          { label: 'Within', value: c.parentName, href: c.parent ? `/circles/${c.parent}` : undefined },
          { label: 'Decides by', value: c.procedure, kind: 'badge' },
          { label: 'Roles', value: c.roles.length, kind: 'number' },
        ],
        related: (c: Detail) => [
          ...(c.parent ? [{ label: c.parentName ?? c.parent, sub: 'parent', href: `/circles/${c.parent}` }] : []),
          ...c.children.map((k) => ({ label: k.name, sub: 'within', href: `/circles/${k.id}` })),
        ],
        blocks: [Structure],
      },
    },
  },
}
