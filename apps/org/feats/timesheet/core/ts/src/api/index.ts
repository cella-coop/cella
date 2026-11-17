// The feat's public writes, POST /api/timesheet/<op> once the server
// exists, the write spec and form readers a graft composes, its reads,
// and its slice, which the shell mounts.
import { action, today, type Slice } from '@cella/org-db'
import { approve, correct, log, submit } from '../handlers/index.ts'
import { entries, entry } from '../drivers/timesheet.ts'
import * as forms from './forms.ts'
import { contract } from './contract.ts'
import { bodyActions, bodyMount, withBody } from './body.ts'

export { approve, correct, correcting, log, logging, submit, submitting } from '../handlers/index.ts'
export { entries, entry, sheet, sheets } from '../drivers/timesheet.ts'
export * as forms from './forms.ts'
export { saveBody } from '../handlers/body.ts'

// The entries, logging one as the acting member, and on an entry's page
// correcting it, and submitting or approving its member's month.
export const slice: Slice = {
  name: 'timesheet',
  queries: contract,
  collections: {
    timesheets: {
      list: entries,
      // The day a new entry is for unless the member says otherwise.
      about: async (db) => ({ today: await today(db) }),
      item: withBody(entry),
      body: bodyMount,
      actions: {
        ...bodyActions,
        log: action('timesheet:entry:log', (form, _, deps) => forms.log(form, deps.actor), log),
        correct: action('timesheet:entry:correct', (form, id) => forms.correct(form, id), correct),
        submit: action('timesheet:period:submit', (_, id, deps) => forms.period(deps.db, id), submit),
        approve: action('timesheet:period:approve', (_, id, deps) => forms.period(deps.db, id), approve),
      },
    },
  },
}
