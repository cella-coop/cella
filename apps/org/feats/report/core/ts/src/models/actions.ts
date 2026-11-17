import { confluent, type Actions } from '@cella/org-actions'

export const actions = {
  // a member's own report, by their right; the last save wins
  'report:report:save': confluent({ power: 'save-report' }),
  // each save carries the whole merged snapshot, so the later receipt holds every edit before it;
  // report:report:save already takes the verb save, so the body's is its own
  'report:body:save-body': confluent({ power: 'discuss' }),
} satisfies Actions
