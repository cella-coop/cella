import { confluent, ordered, type Actions } from '@cella/org-actions'

export const actions = {
  // a fact; a project's id is its slug, and a taken one is refused
  'project:project:create': confluent({ power: 'manage-project' }),
  // appended, numbered under the project's lock
  'project:milestone:add': confluent({ power: 'manage-project' }),
  // idempotent: the first completion's day stands
  'project:milestone:complete': confluent({ power: 'manage-project' }),
  // sets the pot that shares spend; ordered against the shares, so it
  // never falls below what was shared from it
  'project:project:budget': ordered({ power: 'set-budget', amount: 'amount' }),
  // hides the project and freezes it; archiving twice changes nothing
  'project:project:archive': confluent({ power: 'manage-project' }),
} satisfies Actions
