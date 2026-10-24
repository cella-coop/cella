import { confluent, ordered, type Ops } from '@cella/org-ops'

export const ops = {
  // Loro merges them
  'document:document:edit': confluent(),
  // anchored to the text, needs no notary
  'document:document:comment': confluent(),
  // names the adopted version it replaces, not the draft it saw;
  // refused only if that adopted version moved on
  'document:document:adopt': ordered({ base: 'adopted' }),
} satisfies Ops
