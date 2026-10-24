import { confluent, type Ops } from '@cella/org-ops'

export const ops = {
  // the filing is a register: the last writer wins; a task is in one project
  'project-task:task:file': confluent({ power: 'edit-task' }),
} satisfies Ops

export interface File {
  task: string
  project: string
  milestone?: number
}
