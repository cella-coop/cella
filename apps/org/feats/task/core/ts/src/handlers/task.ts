import type { Outcome } from '@cella/org-actions'
import { personal, write, type Deps, type Write } from '@cella/org-db'
import type { actions } from '../models/actions.ts'
import type { Complete, Create, Created, Move, Moved, Save, Saved } from '../models/task.ts'

type Action = keyof typeof actions
type Out<O extends Action, T> = Promise<Outcome<(typeof actions)[O], T>>

// Creates a task on the verdict date, numbered by the server. A graft
// that files a new task under something of its own, as a project, runs
// this in its own write.
export const creating = (input: Create): Write<Created> => ({
  op: 'task:task:create' satisfies Action,
  request: input,
  state: async (tx) => {
    const { rows } = await tx.query<{ id: string; created: string }>(
      `INSERT INTO task.task (title, priority, due, status, created)
       VALUES ($1, $2, $3, $4, cella.verdict_date())
       RETURNING id, to_char(created, 'YYYY-MM-DD') AS created`,
      [input.title, input.priority ?? 'normal', input.due || null, input.status ?? 'todo'],
    )
    return { task: rows[0].id, created: rows[0].created }
  },
  // The task as it was made, which its fold writes. The title may name a
  // person, so the log keeps its commitment and the vault the title.
  payload: (v) => ({
    ...v,
    title: personal('task.task.title', v.task, input.title),
    priority: input.priority ?? 'normal',
    due: input.due || null,
    status: input.status ?? 'todo',
  }),
})

export async function create(input: Create, deps: Deps): Out<'task:task:create', Created> {
  return write(deps, creating(input))
}

// Sets the status register, short of done: moving a done task back
// reopens it.
export async function move(input: Move, deps: Deps): Out<'task:task:move', Moved> {
  return write(deps, {
    op: 'task:task:move' satisfies Action,
    request: input,
    state: async (tx) => {
      const { rowCount } = await tx.query('UPDATE task.task SET status = $2, completed = NULL WHERE id = $1', [input.task, input.status])
      if (!rowCount) {
        throw new Error(`no task ${input.task}`)
      }
      return { task: input.task, status: input.status, completed: null }
    },
    payload: (v) => ({ ...v }),
  })
}

// Sets the status done on the verdict date; completing a done task keeps
// its first day.
export async function complete(input: Complete, deps: Deps): Out<'task:task:complete', Moved> {
  return write(deps, {
    op: 'task:task:complete' satisfies Action,
    request: input,
    state: async (tx) => {
      const { rows } = await tx.query<{ completed: string }>(
        `UPDATE task.task SET status = 'done', completed = coalesce(completed, cella.verdict_date())
         WHERE id = $1 RETURNING to_char(completed, 'YYYY-MM-DD') AS completed`,
        [input.task],
      )
      if (!rows[0]) {
        throw new Error(`no task ${input.task}`)
      }
      return { task: input.task, status: 'done' as const, completed: rows[0].completed }
    },
    payload: (v) => ({ ...v }),
  })
}

// Saves a task's body: the merged snapshot an editor's browser signs,
// with who contributed since the last save, each of whom the feat's guard
// asks holds `discuss` in the task's circle, as the saver must. The
// payload names the circle the handler read, which the power's guard
// reads. A snapshot with no canonical form is refused by the column.
export async function save(input: Save, deps: Deps): Out<'task:body:save', Saved> {
  let snapshot = ''
  return write(deps, {
    op: 'task:body:save' satisfies Action,
    request: input,
    state: async (tx) => {
      const { rows } = await tx.query<{ circle: string; snapshot: string }>(
        `UPDATE task.task SET body = $2 WHERE id = $1 RETURNING circle, encode(body, 'hex') AS snapshot`,
        [input.task, input.snapshot],
      )
      if (!rows[0]) {
        throw new Error(`no task ${input.task}`)
      }
      snapshot = rows[0].snapshot
      return { task: input.task, circle: rows[0].circle }
    },
    // The log keeps the snapshot, in hex, which its fold sets the body to,
    // and who contributed to it since the last.
    payload: (v) => ({ ...v, snapshot, contributors: [...new Set(input.contributors)].sort() }),
  })
}
