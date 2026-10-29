import type { Analytics } from '@cella/org-analytics'
import { fromEnv, shell } from '@cella/org-analytics/api'

// The analytics port the server hands the report feat, over the shell
// `cella` names in its environment, opened at its first run and kept; one
// that fails to open is tried again at the next. With no shell named, a
// run fails with why, and a report's page says so.
let opened: ReturnType<typeof shell> | null = null

function open() {
  const options = fromEnv()
  if (!options) {
    throw new Error('the analytics shell is not running: `cella serve` and `cella db start` start it')
  }
  opened ??= shell(options).catch((e) => {
    opened = null
    throw e
  })
  return opened
}

export const port: Analytics = {
  catalog: async () => (await open()).catalog(),
  run: async (report) => (await open()).run(report),
}
