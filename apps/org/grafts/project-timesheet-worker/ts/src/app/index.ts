import type { App } from '@cella/org-ui'
import Week from './blocks/Week.svelte'

// The graft's client side: the acting worker's week behind the
// timesheets' New button, replacing the one entry the timesheet feat
// offers, logged as the grid's writes.
export const app: App = {
  name: 'project-timesheet-worker',
  extends: {
    timesheets: { create: Week },
  },
}
