import { confluent, type Actions } from '@cella/org-actions'

export const actions = {
  // the last writer wins; a project is for one client
  'client-project:project:link': confluent({ power: 'manage-project' }),
} satisfies Actions

export interface Link {
  project: string
  client: string
}
