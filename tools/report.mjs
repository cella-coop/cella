// report: runs a report definition, a JSON file, through the analytics
// port, as a page would: checked against the views the slices publish,
// then run in the analytics shell on one snapshot, stamped with the log's
// head. Prints the result as JSON; a report the port refuses prints each
// reason and exits 2. `cella analytics query --report FILE` runs it with
// the shell's address, its token's file and DuckDB's extensions in its
// environment.

import { readFileSync } from 'node:fs'
import { Invalid } from '../apps/org/core/analytics/ts/src/index.ts'
import { fromEnv, shell } from '../apps/org/core/analytics/ts/src/api/index.ts'

const file = process.argv[2]
if (!file) {
  console.error('report: give a report definition, a JSON file')
  process.exit(2)
}
const options = fromEnv()
if (!options) {
  console.error('report: CELLA_ANALYTICS, CELLA_ANALYTICS_TOKEN_FILE and CELLA_DUCKDB_EXTENSIONS name the shell; run it through `cella analytics query --report`')
  process.exit(2)
}
const analytics = await shell(options)
try {
  console.log(JSON.stringify(await analytics.run(JSON.parse(readFileSync(file, 'utf8'))), null, 2))
} catch (e) {
  if (!(e instanceof Invalid)) {
    throw e
  }
  for (const reason of e.reasons) {
    console.error(`report: ${reason}`)
  }
  process.exitCode = 2
} finally {
  analytics.close()
}
