import { confluent, type Actions } from '@cella/org-actions'

export const actions = {
  // the filing is a register: the last writer wins; a task is in one project
  'project-task:task:file': confluent({ power: 'edit-task' }),
} satisfies Actions

export interface File {
  task: string
  project: string
  milestone?: number
}
