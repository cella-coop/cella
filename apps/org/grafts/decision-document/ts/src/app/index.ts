import type { App, Embed } from '@cella/org-ui'
import type { OnDecision, OnDocument } from '../models/adoption.ts'
import Adoption from './blocks/Adoption.svelte'
import Card from './blocks/Card.svelte'

// A decision drawn inside a document, and offered by its draft's slash
// menu: the document feat knows embeds only by kind and ref.
const decision: Embed<OnDocument> = {
  label: 'Decision',
  block: Card,
  choices: (d) => d.decisions.map((x) => ({ ref: x.id, label: x.title })),
}

// The graft's client side: the version a decision adopts, in full on the
// decision's overview, and on a document's page the decisions that adopt
// its versions and the decisions its draft embeds.
export const app: App = {
  name: 'decision-document',
  extends: {
    decisions: {
      page: {
        properties: (d: OnDecision) =>
          d.adopting.map((x) => ({ label: x.adopted ? 'Adopted' : 'Adopts', value: x.version, kind: 'mono' as const, href: `/documents/${x.document}` })),
        related: (d: OnDecision) => d.adopting.map((x) => ({ label: x.name, sub: x.version, href: `/documents/${x.document}` })),
        blocks: [{ tab: 'overview', block: Adoption }],
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
