// The graft's writes, POST /api/employment-project-timesheet/<op> once the
// server exists, its reads, and its slice, which the shell mounts.
import { done as made, type Action, type Done, type Slice } from '@cella/org-db'
import { forms } from '@cella/org-timesheet/api'
import { log } from '@cella/org-graft-employment-timesheet/api'
import { book } from '../handlers/book.ts'
import { weeks } from '../drivers/week.ts'
import { cell, type Cell } from '../models/week.ts'
import { harvest, toggl } from './imports.ts'

export { book } from '../handlers/book.ts'
export { week, weeks, monday } from '../drivers/week.ts'

// The cells the grid sends: its rows and days, and the hours typed into
// each, read as the timesheet feat reads hours.
const typed = (get: (name: string) => string, all: (name: string) => string[]): Cell[] =>
  all('row').flatMap((row) =>
    all('day').flatMap((day) => {
      const project = row === '_' ? '' : row
      const hours = get(cell(project, day))
      return hours.trim() ? [{ project, day, minutes: forms.minutes(hours) }] : []
    }),
  )

// A week entered in the grid: each cell typed into, one write each, in
// the grid's order, the acting worker's own time by their employment: to
// a project, this graft's booking; the co-op's own time,
// employment-timesheet's log. Billable is project time. The first refusal
// stops the rest, the writes before it standing, and names their cells as
// spent, so the grid empties them and trying again adds only the rest;
// the outcome shown is the last write's, the others after it.
const entered: Action = {
  op: 'employment-project-timesheet:entry:book',
  run: async (form, deps) => {
    const cells = typed(form.get, form.all)
    if (!cells.length) {
      throw new Error('type the hours into a day of a project, or of the co-op’s own time')
    }
    const outcomes: Done[] = []
    const spent: string[] = []
    for (const c of cells) {
      const entry = { member: deps.actor, day: c.day, minutes: c.minutes, billable: c.project !== '' }
      const done = c.project
        ? made('employment-project-timesheet:entry:book', await book({ ...entry, project: c.project }, deps))
        : made('employment-timesheet:entry:log', await log(entry, deps))
      outcomes.push(done)
      if (done.state !== 'settled') {
        break
      }
      spent.push(cell(c.project, c.day))
    }
    const last = outcomes[outcomes.length - 1]
    const stopped = last.state !== 'settled' && spent.length > 0
    return { request: cells, done: { ...last, then: outcomes.slice(0, -1), ...(stopped ? { spent } : {}) } }
  },
}

// The acting worker's weeks on the timesheets' page, behind its New
// button, and the week entered there; and time imported from Toggl's
// and Harvest's exports.
export const slice: Slice = {
  name: 'employment-project-timesheet',
  imports: { toggl, harvest },
  extends: {
    timesheets: {
      about: async (db, actor) => ({ weeks: await weeks(db, actor ?? null) }),
      actions: { week: entered },
    },
  },
}
