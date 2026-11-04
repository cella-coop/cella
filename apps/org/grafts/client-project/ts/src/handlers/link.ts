import type { Outcome } from '@cella/org-actions'
import { write, type Deps } from '@cella/org-db'
import type { Link, actions } from '../models/actions.ts'

const op = 'client-project:project:link' satisfies keyof typeof actions

// Links a project to the client it is for; linking again moves it. The
// graft's trigger refuses a project or a client that does not exist. The
// payload names the project's circle, which the guard reads the
// manage-project mandate's scope against.
export async function link(input: Link, deps: Deps): Promise<Outcome<(typeof actions)[typeof op], Link & { circle: string }>> {
  return write(deps, {
    op,
    request: input,
    state: async (tx) => {
      await tx.query(
        `INSERT INTO client_project.commission (project, client) VALUES ($1, $2)
         ON CONFLICT (project) DO UPDATE SET client = excluded.client`,
        [input.project, input.client],
      )
      const { rows } = await tx.query<{ circle: string }>('SELECT circle FROM project.project WHERE id = $1', [input.project])
      return { ...input, circle: rows[0]?.circle ?? '' }
    },
    payload: (v) => ({ ...v }),
  })
}
