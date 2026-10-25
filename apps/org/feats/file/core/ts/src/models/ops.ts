import { confluent, type Ops } from '@cella/org-ops'

export const ops = {
  // a new file is a fact, the uploader's own; two uploads commute
  'file:file:upload': confluent({ check: 'self' }),
} satisfies Ops
