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
  // a cosmetic setting, apart from what it manages; the last writer wins
  'project:project:icon': confluent({ power: 'manage-project' }),
  // each save carries the whole merged snapshot, so the later receipt holds every edit before it
  'project:body:save': confluent({ power: 'discuss' }),
  // a fact: comments are appended, each numbered by receipt
  'project:comment:post': confluent({ power: 'discuss' }),
  // resolving a root or reopening it is a register: the last writer wins
  'project:comment:resolve': confluent({ power: 'discuss' }),
  // a toggle: one reaction per comment, person and emoji, the last writer wins
  'project:comment:react': confluent({ power: 'discuss' }),
} satisfies Actions
