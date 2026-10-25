import type { App, Embed } from '@cella/org-ui'
import type { OnDecision, OnDocument } from '../models/adoption.ts'
import { Card } from '@cella/org-decision/app'
import Adoption from './blocks/Adoption.svelte'
import Linked from './blocks/Linked.svelte'

// A decision drawn inside a document, and offered by its draft's slash
// menu: the document feat knows embeds only by kind and ref.
const decision: Embed<OnDocument> = {
  label: 'Decision',
  block: Card,
  choices: (d) => d.decisions.map((x) => ({ ref: x.id, label: x.title })),
}

// The graft's client side: the version a decision adopts, in full on the
// decision's overview, and on a document's page the decisions that adopt
// its versions and the decisions its draft embeds; and the documents a
// decision's discussion links, drawn inside its messages.
export const app: App = {
  name: 'decision-document',
  extends: {
    decisions: {
      page: {
        properties: (d: OnDecision) =>
          d.adopting.map((x) => ({ label: x.adopted ? 'Adopted' : 'Adopts', value: x.version, kind: 'mono' as const, href: `/documents/${x.document}` })),
        related: (d: OnDecision) => d.adopting.map((x) => ({ label: x.name, sub: x.version, href: `/documents/${x.document}` })),
        blocks: [{ tab: 'overview', block: Adoption }],
        // The documents a message of its discussion links.
        embeds: { document: { label: 'Document', block: Linked } satisfies Embed<OnDecision> },
      },
    },
    documents: {
      page: {
        related: (d: OnDocument) =>
          d.asked.map((x) => ({ label: x.title, sub: `${x.decision}, ${x.adopted ? 'adopted' : 'to adopt'} ${x.version}`, href: `/decisions/${x.decision}` })),
        embeds: { decision },
      },
    },
  },
}
