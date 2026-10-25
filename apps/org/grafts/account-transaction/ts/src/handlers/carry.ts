import type { Outcome } from '@cella/org-ops'
import { write, type Deps } from '@cella/org-db'
import { opening } from '@cella/org-account/api'
import type { Open } from '@cella/org-account/models'
import { posting } from '@cella/org-transaction/api'
import type { Entry, Posted, ops } from '@cella/org-transaction/models'

// Carries an entry over from the co-op's last tool in one write: the
// accounts it names that the chart lacks, opened of the kind their class
// makes them, then the entry, posted. The log names the accounts opened,
// and `account_transaction.opens` checks them.
export async function carry(
  entry: Entry,
  accounts: Open[],
  deps: Deps,
): Promise<Outcome<(typeof ops)['transaction:transaction:post'], Posted & { opened: string[] }>> {
  const w = posting(entry)
  return write(deps, {
    op: w.op,
    request: { ...entry, accounts },
    state: async (tx, proof) => {
      const opened = await opening(tx, accounts)
      return { ...(await w.state(tx, proof)), opened }
    },
    payload: (v) => ({ ...w.payload(v), opened: v.opened }),
  })
}
