import { confluent, ordered, type Ops } from '@cella/org-ops'

export const ops = {
  // a fact; a document's id is its slug, and a taken one is refused
  'document:document:create': confluent({ power: 'edit-document' }),
  // Loro merges them
  'document:document:edit': confluent({ power: 'edit-document' }),
  // a version is the text at a frontier; two saves are two versions
  'document:document:version': confluent({ power: 'edit-document' }),
  // anchored to the text, needs no notary
  'document:document:comment': confluent({ power: 'edit-document' }),
  // names the adopted version it replaces, not the draft it saw;
  // refused only if that adopted version moved on
  'document:document:adopt': ordered({ base: 'adopted', check: 'decided' }),
} satisfies Ops
