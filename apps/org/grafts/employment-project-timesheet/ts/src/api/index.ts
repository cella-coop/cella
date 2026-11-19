// The graft's reads, its week entered as the timesheet feat's writes, and
// its slice, which the shell mounts.
import { done as made, type Action, type Done, type Slice } from '@cella/org-db'
import { forms, log } from '@cella/org-timesheet/api'
import { book } from '@cella/org-graft-project-timesheet/api'
import { weeks } from '../drivers/week.ts'
import { cell, circle, type Cell } from '../models/week.ts'
import { harvest, toggl } from './imports.ts'

export { week, weeks, monday } from '../drivers/week.ts'

// The cells the grid sends: its rows and days, the hours typed into
// each, read as the timesheet feat reads hours, and the circle its row
// names.
const typed = (get: (name: string) => string, all: (name: string) => string[]): Cell[] =>
  all('row').flatMap((row) =>
    all('day').flatMap((day) => {
      const project = row === '_' ? '' : row
      const hours = get(cell(project, day))
      return hours.trim() ? [{ project, day, minutes: forms.minutes(hours), circle: get(circle(project)) || undefined }] : []
    }),
  )

// A week entered in the grid: each cell typed into, one write each, in
// the grid's order, the acting worker's own time, worked for the circle
// its row names and logged in that circle's month: to a project,
// project-timesheet's booking; the coop's own time, the timesheet feat's
// log. Both are `timesheet:entry:log`, by every employee's right.
// Billable is project time. The first refusal stops the rest, the writes
// before it standing, and names their cells as spent, so the grid empties
// them and trying again adds only the rest; the outcome shown is the last
// write's, the others after it.
const entered: Action = {
  op: 'timesheet:entry:log',
  run: async (form, deps) => {
    const cells = typed(form.get, form.all)
    if (!cells.length) {
      throw new Error('type the hours into a day of a project, or of the coop’s own time')
    }
    const outcomes: Done[] = []
    const spent: string[] = []
    for (const c of cells) {
      const entry = { member: deps.actor, day: c.day, minutes: c.minutes, billable: c.project !== '', circle: c.circle }
      const done = made('timesheet:entry:log', c.project ? await book({ ...entry, project: c.project }, deps) : await log(entry, deps))
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
