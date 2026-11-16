// The analytics shell a scenario reads its reports through: `cella
// analytics` started on the test database at a port of the scenario's own,
// its views reckoned on the scenario's day, and the port over it, as the
// server holds one; `env` hands the same shell to the built server.

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type pg from 'pg'
import type { Analytics } from '@cella/org-analytics'
import { shell } from '@cella/org-analytics/api'

const repo = new URL('../../../../', import.meta.url).pathname
const bin = process.env.CELLA_BIN ?? 'cella'

// A scenario's port: its worker's, `CELLA_ANALYTICS_PORT` (54343 unset), which
// `cella test e2e` sets a hundred past the worker's before it, plus an
// offset of the scenario's, never a fixed one, so runs at once never meet
// on one, nor two workers of a run, nor a scenario on the run's dev shell.
export const own = (offset: number) => String((Number(process.env.CELLA_ANALYTICS_PORT) || 54343) + offset)

export interface Reading {
  analytics: Analytics & { close: () => void }
  env: NodeJS.ProcessEnv
  stop: () => void
}

export async function reading(su: pg.Client, offset: number, day: string): Promise<Reading> {
  const port = own(offset)
  const db = su.database ?? ''
  // The views read the scope's day as the role's sessions see it.
  await su.query(`ALTER ROLE cella_analytics IN DATABASE ${su.escapeIdentifier(db)} SET cella.clock = '${day}'`)
  const stop = () => execFileSync(bin, ['analytics', 'stop', '--port', port], { cwd: repo })
  stop()
  execFileSync(bin, ['analytics', 'start', '--db', db, '--port', port], { cwd: repo })
  const url = `quack:127.0.0.1:${port}`
  const token = join(repo, '.data/analytics', port, 'token')
  const analytics = await shell({ url, token: readFileSync(token, 'utf8').trim(), extensions: process.env.CELLA_DUCKDB_EXTENSIONS ?? '' })
  return {
    analytics,
    env: { CELLA_ANALYTICS: url, CELLA_ANALYTICS_TOKEN_FILE: token },
    stop: () => {
      analytics.close()
      stop()
    },
  }
}
