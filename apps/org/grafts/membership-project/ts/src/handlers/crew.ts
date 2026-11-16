import type { Outcome } from '@cella/org-actions'
import { write, type Deps } from '@cella/org-db'
import type { actions, Crew } from '../models/actions.ts'

const op = 'membership-project:project:crew' satisfies keyof typeof actions

// Sets who leads a project and who's on it, Linear's lead and members,
// independent of who edits it: the lead replaced by the one named, or by
// no one, and the members replaced by the whole list named. The graft's
// trigger refuses one not an active member.
export async function crew(input: Crew, deps: Deps): Promise<Outcome<(typeof actions)[typeof op], Crew & { circle: string }>> {
  return write(deps, {
    op,
    request: input,
    state: async (tx) => {
      await tx.query('DELETE FROM membership_project.lead WHERE project = $1', [input.project])
      if (input.lead) {
        await tx.query('INSERT INTO membership_project.lead (project, member) VALUES ($1, $2)', [input.project, input.lead])
      }
      await tx.query('DELETE FROM membership_project.member WHERE project = $1', [input.project])
      for (const member of input.members) {
        await tx.query('INSERT INTO membership_project.member (project, member) VALUES ($1, $2)', [input.project, member])
      }
      const { rows } = await tx.query<{ circle: string }>('SELECT circle FROM project.project WHERE id = $1', [input.project])
      return { ...input, circle: rows[0]?.circle ?? '' }
    },
    payload: (v) => ({ ...v }),
  })
}
