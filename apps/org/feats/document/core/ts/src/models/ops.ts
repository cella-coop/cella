import { confluent, ordered, type Ops } from '@cella/org-core'

export const ops = {
  // Loro merges them
  'document:document:edit': confluent(),
  // anchored to the text, needs no notary
  'document:document:comment': confluent(),
  // names the version it saw; refused if that moved on
  'document:document:adopt': ordered({ base: 'adopted' }),
} satisfies Ops
