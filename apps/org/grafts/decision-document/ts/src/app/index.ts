import type { App } from '@cella/org-ui'
import type { Asked } from '../models/adoption.ts'

// The graft's client side: the version a decision adopts, and the
// decisions that adopt a document's versions.
export const app: App = {
  name: 'decision-document',
  extends: {
    decisions: {
      page: {
        properties: (a: Asked[]) =>
          a.map((x) => ({ label: x.adopted ? 'Adopted' : 'Adopts', value: x.version, kind: 'mono' as const, href: `/documents/${x.document}` })),
        related: (a: Asked[]) => a.map((x) => ({ label: x.document, sub: x.version, href: `/documents/${x.document}` })),
      },
    },
    documents: {
      page: {
        related: (a: Asked[]) => a.map((x) => ({ label: x.title, sub: `${x.decision}, ${x.adopted ? 'adopted' : 'to adopt'} ${x.version}`, href: `/decisions/${x.decision}` })),
      },
    },
  },
}
