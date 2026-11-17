import type { Outcome } from '@cella/org-actions'
import { write, type Deps } from '@cella/org-db'
import type { actions } from '../models/actions.ts'
import type { Add, Added, Archive, Archived, Budget, Budgeted, Complete, Completed, Create, Created, Icon, Iconed } from '../models/project.ts'

type Action = keyof typeof actions
type Out<O extends Action, T> = Promise<Outcome<(typeof actions)[O], T>>

// A project's id from its title: lower case, unaccented, words joined by
// hyphens.
export const slug = (title: string) =>
  title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)

// Starts a project on the verdict date. Its id is its slug; a taken one
// is refused rather than overwritten.
export async function create(input: Create, deps: Deps): Out<'project:project:create', Created> {
  const id = input.id ?? slug(input.title)
  return write(deps, {
    op: 'project:project:create' satisfies Action,
    request: input,
    state: async (tx) => {
      const taken = await tx.query('SELECT FROM project.project WHERE id = $1', [id])
      if (taken.rowCount) {
        throw new Error(`a project ${id} exists already`)
      }
      const { rows } = await tx.query<{ started: string; circle: string }>(
        `INSERT INTO project.project (id, title, circle, summary, started, due)
         VALUES ($1, $2, $3, $4, cella.verdict_date(), $5)
         RETURNING to_char(started, 'YYYY-MM-DD') AS started, circle`,
        [id, input.title, input.circle || null, input.summary ?? '', input.due || null],
      )
      return { project: id, circle: rows[0].circle, started: rows[0].started }
    },
    // What it was started with, so its entry folds to it.
    payload: (v) => ({ ...v, title: input.title, summary: input.summary ?? '', due: input.due || null }),
  })
}

// Appends a milestone, numbered after the last under the project's lock,
// so two added at once take two numbers.
export async function add(input: Add, deps: Deps): Out<'project:milestone:add', Added> {
  return write(deps, {
    op: 'project:milestone:add' satisfies Action,
    request: input,
    state: async (tx) => {
      const locked = await tx.query<{ circle: string }>('SELECT circle FROM project.project WHERE id = $1 FOR UPDATE', [input.project])
      if (!locked.rowCount) {
        throw new Error(`no project ${input.project}`)
      }
      const { rows } = await tx.query<{ n: number }>(
        `INSERT INTO project.milestone (project, n, title, due)
         SELECT $1, coalesce(max(n), 0) + 1, $2, $3 FROM project.milestone WHERE project = $1
         RETURNING n`,
        [input.project, input.title, input.due || null],
      )
      return { project: input.project, circle: locked.rows[0].circle, n: rows[0].n }
    },
    // Its title and due day, so its entry folds to it.
    payload: (v) => ({ ...v, title: input.title, due: input.due || null }),
  })
}

// Completes a milestone on the verdict date; completing it again keeps the
// first day.
export async function complete(input: Complete, deps: Deps): Out<'project:milestone:complete', Completed> {
  return write(deps, {
    op: 'project:milestone:complete' satisfies Action,
    request: input,
    state: async (tx) => {
      const { rows } = await tx.query<{ completed: string; circle: string }>(
        `UPDATE project.milestone SET completed = coalesce(completed, cella.verdict_date())
         WHERE project = $1 AND n = $2 RETURNING to_char(completed, 'YYYY-MM-DD') AS completed, circle`,
        [input.project, input.n],
      )
      if (!rows[0]) {
        throw new Error(`${input.project} has no milestone ${input.n}`)
      }
      return { project: input.project, circle: rows[0].circle, n: input.n, completed: rows[0].completed }
    },
    payload: (v) => ({ ...v }),
  })
}

// Sets the pot. Ordered: `project.budgets` checks the write set it, and
// the membership-project graft's guard that it still covers the shares.
export async function budget(input: Budget, deps: Deps): Out<'project:project:budget', Budgeted> {
  return write(deps, {
    op: 'project:project:budget' satisfies Action,
    request: input,
    state: async (tx) => {
      const { rows } = await tx.query<{ circle: string }>(
        'UPDATE project.project SET budget = cella.amount($2) WHERE id = $1 RETURNING circle',
        [input.project, input.amount],
      )
      return { ...input, circle: rows[0]?.circle ?? '' }
    },
    payload: (v) => ({ ...v }),
  })
}

// Archives a project on the verdict date: hidden from the lists, kept for
// the books, frozen.
export async function archive(input: Archive, deps: Deps): Out<'project:project:archive', Archived> {
  return write(deps, {
    op: 'project:project:archive' satisfies Action,
    request: input,
    state: async (tx) => {
      await tx.query('UPDATE project.project SET archived = cella.verdict_date() WHERE id = $1 AND archived IS NULL', [input.project])
      const { rows } = await tx.query<{ archived: string | null; circle: string }>(
        `SELECT to_char(archived, 'YYYY-MM-DD') AS archived, circle FROM project.project WHERE id = $1`,
        [input.project],
      )
      if (!rows[0]) {
        throw new Error(`no project ${input.project}`)
      }
      return { project: input.project, circle: rows[0].circle, archived: rows[0].archived }
    },
    payload: (v) => ({ ...v }),
  })
}

// Sets or clears a project's own icon, a cosmetic setting apart from the
// rest: the last write wins.
export async function icon(input: Icon, deps: Deps): Out<'project:project:icon', Iconed> {
  return write(deps, {
    op: 'project:project:icon' satisfies Action,
    request: input,
    state: async (tx) => {
      const { rows } = await tx.query<{ circle: string }>(
        'UPDATE project.project SET icon = $2 WHERE id = $1 RETURNING circle',
        [input.project, input.icon],
      )
      if (!rows[0]) {
        throw new Error(`no project ${input.project}`)
      }
      return { project: input.project, circle: rows[0].circle, icon: input.icon }
    },
    payload: (v) => ({ ...v }),
  })
}
