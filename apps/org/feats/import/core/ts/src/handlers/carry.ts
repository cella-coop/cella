import type { Outcome } from '@cella/org-ops'
import { write, type Db, type Deps } from '@cella/org-db'
import type { ops } from '../models/ops.ts'
import type { Carried } from '../models/run.ts'

const op = 'import:state:carry' satisfies keyof typeof ops

// The state a scope held before its log, carried in by `load` inside the
// write's transaction, which answers how many rows of each kind it wrote;
// `from` names where it came from, such as a fixture.
export interface Carrying {
  from: string
  load: (tx: Db) => Promise<Record<string, number>>
}

// Carries a scope's state from before its log into it, as one write that
// the carrier signs: `import.carries` lets it settle only as the log's
// first entry, so the state before the log comes in once. The log keeps
// how many rows of each kind came, never the rows.
export async function carry(input: Carrying, deps: Deps): Promise<Outcome<(typeof ops)[typeof op], Carried>> {
  return write(deps, {
    op,
    request: { from: input.from },
    state: async (tx) => ({ from: input.from, carried: await input.load(tx) }),
    payload: (v) => ({ ...v }),
  })
}
