import type { Outcome } from '@cella/org-actions'
import { write, type Deps } from '@cella/org-db'
import { opening } from '@cella/org-account/api'
import type { Open } from '@cella/org-account/models'
import { logged, record } from '@cella/org-transaction/api'
import type { Entry, Posted } from '@cella/org-transaction/models'
import type { actions } from '../models/actions.ts'

const op = 'account-transaction:entry:carry' satisfies keyof typeof actions

// Carries an entry over from the coop's last tool in one write: the
// accounts it names that the chart lacks, opened of the kind their class
// makes them, then the entry, recorded in the journal. The log commits
// to the entry as the journal keeps it, as a post does, and names the
// accounts it asked to open, with their labels, and those it opened;
// `account_transaction.carries` checks both.
export async function carry(entry: Entry, accounts: Open[], deps: Deps): Promise<Outcome<(typeof actions)[typeof op], Posted & { opened: string[] }>> {
  return write(deps, {
    op,
    request: { ...entry, accounts },
    state: async (tx) => {
      const opened = await opening(tx, accounts)
      return { ...(await record(tx, entry)), opened }
    },
    payload: (v) => ({ entry: v.entry, ...logged(entry), accounts, opened: v.opened }),
  })
}
