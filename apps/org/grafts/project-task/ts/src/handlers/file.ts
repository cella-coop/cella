import type { Refused, Settled } from '@cella/org-ops'
import { write, type Db, type Deps } from '@cella/org-db'
import { creating } from '@cella/org-task/api'
import type { Create, Created } from '@cella/org-task/models'
import type { File, ops } from '../models/ops.ts'

const op = 'project-task:task:file' satisfies keyof typeof ops

const filing = (tx: Db, f: File) =>
  tx.query(
    `INSERT INTO project_task.filing (task, project, milestone) VALUES ($1, $2, $3)
     ON CONFLICT (task) DO UPDATE SET project = excluded.project, milestone = excluded.milestone`,
    [f.task, f.project, f.milestone ?? null],
  )

// Files a task under a project, and one of its milestones if named;
// filing it again moves it. The graft's trigger refuses a task, project or
// milestone that does not exist, or an archived project.
export async function file(input: File, deps: Deps): Promise<Settled<File> | Refused> {
  return write(deps, {
    op,
    request: input,
    state: async (tx) => {
      await filing(tx, input)
      return input
    },
    payload: (v) => ({ ...v }),
  })
}

export interface Within extends Create {
  project: string
  milestone?: number
}

// A new task already in a project: the task feat's creation and its
// filing, in one transaction under one verdict, the creation's op.
export async function within(input: Within, deps: Deps): Promise<Settled<Created & { project: string }> | Refused> {
  const { project, milestone, ...task } = input
  const w = creating(task)
  return write(deps, {
    op: w.op,
    request: input,
    state: async (tx, proof) => {
      const made = await w.state(tx, proof)
      await filing(tx, { task: made.task, project, milestone })
      return { ...made, project }
    },
    payload: (v) => ({ ...w.payload(v), project: v.project }),
  })
}
