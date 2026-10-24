import type { Outcome } from '@cella/org-ops'
import { write, type Deps } from '@cella/org-db'
import type { Assign, ops } from '../models/ops.ts'

const op = 'member-task:task:assign' satisfies keyof typeof ops

// Gives a task to a member, or takes it from whoever had it when the
// member is none. The graft's trigger refuses a task that does not exist
// or an assignee who is not an active member.
export async function assign(input: Assign, deps: Deps): Promise<Outcome<(typeof ops)[typeof op], Assign>> {
  return write(deps, {
    op,
    request: input,
    state: async (tx) => {
      if (input.member) {
        await tx.query(
          `INSERT INTO member_task.assignment (task, member) VALUES ($1, $2)
           ON CONFLICT (task) DO UPDATE SET member = excluded.member`,
          [input.task, input.member],
        )
      } else {
        await tx.query('DELETE FROM member_task.assignment WHERE task = $1', [input.task])
      }
      return input
    },
    payload: (v) => ({ ...v }),
  })
}
