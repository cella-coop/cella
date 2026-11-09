import type { App, Embed } from '@cella/org-ui'
import type { OnMotion, OnDocument } from '../models/adoption.ts'
import { Card } from '@cella/org-motion/bindings'
import Adoption from './blocks/Adoption.svelte'
import Linked from './blocks/Linked.svelte'

// A motion drawn inside a document, and offered by its draft's slash
// menu: the document feat knows embeds only by kind and ref.
const motion: Embed<OnDocument> = {
  label: 'Motion',
  block: Card,
  choices: (d) => d.motions.map((x) => ({ ref: x.id, label: x.title })),
}

// The graft's client side: the version a motion adopts, in full on the
// motion's overview, and on a document's page the motions that adopt
// its versions and the motions its draft embeds; and the documents a
// motion's discussion links, drawn inside its messages.
export const app: App = {
  name: 'document-motion',
  extends: {
    motions: {
      page: {
        properties: (d: OnMotion) =>
          d.adopting.map((x) => ({ label: x.adopted ? 'Adopted' : 'Adopts', value: x.version, kind: 'mono' as const, href: `/documents/${x.document}` })),
        related: (d: OnMotion) => d.adopting.map((x) => ({ label: x.name, sub: x.version, href: `/documents/${x.document}` })),
        blocks: [{ tab: 'overview', block: Adoption }],
        // The documents a message of its discussion links.
        embeds: { document: { label: 'Document', block: Linked } satisfies Embed<OnMotion> },
      },
    },
    documents: {
      page: {
        related: (d: OnDocument) =>
          d.asked.map((x) => ({ label: x.title, sub: `${x.motion}, ${x.adopted ? 'adopted' : 'to adopt'} ${x.version}`, href: `/motions/${x.motion}` })),
        embeds: { motion },
      },
    },
  },
}
