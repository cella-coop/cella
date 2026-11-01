import type { Outcome } from '@cella/org-actions'
import { write, type Deps } from '@cella/org-db'
import type { Assign, actions } from '../models/actions.ts'

const op = 'membership-task:task:assign' satisfies keyof typeof actions

// Gives a task to a member, or takes it from whoever had it when the
// member is none. The graft's trigger refuses a task that does not exist
// or an assignee who is not an active member.
export async function assign(input: Assign, deps: Deps): Promise<Outcome<(typeof actions)[typeof op], Assign>> {
  return write(deps, {
    op,
    request: input,
    state: async (tx) => {
      if (input.member) {
        await tx.query(
          `INSERT INTO membership_task.assignment (task, member) VALUES ($1, $2)
           ON CONFLICT (task) DO UPDATE SET member = excluded.member`,
          [input.task, input.member],
        )
      } else {
        await tx.query('DELETE FROM membership_task.assignment WHERE task = $1', [input.task])
      }
      return input
    },
    payload: (v) => ({ ...v }),
  })
}
