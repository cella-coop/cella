import { confluent, ordered, type Ops } from '@cella/org-ops'

export const ops = {
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
