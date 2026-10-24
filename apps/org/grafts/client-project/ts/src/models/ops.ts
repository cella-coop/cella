import { confluent, type Ops } from '@cella/org-ops'

export const ops = {
  // the last writer wins; a project is for one client
  'client-project:project:link': confluent({ power: 'manage-project' }),
} satisfies Ops

export interface Link {
  project: string
  client: string
}
