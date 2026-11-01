import type { Outcome } from '@cella/org-actions'
import { write, type Db, type Deps, type Write } from '@cella/org-db'
import type { actions } from '../models/actions.ts'
import type { Freeze, Frozen } from '../models/account.ts'

const op = 'account:account:freeze' satisfies keyof typeof actions

// Freezes, inside a write's transaction, every account the holder holds
// that is not frozen yet; a frozen account never thaws
// (`account.stays_frozen`). Returns the codes frozen.
export async function freezing(tx: Db, holder: string): Promise<string[]> {
  const { rows } = await tx.query<{ code: string }>(
    'UPDATE account.account SET frozen = true WHERE holder = $1 AND NOT frozen RETURNING code',
    [holder],
  )
  return rows.map((r) => r.code).sort()
}

// The freeze as a write of its own, citing the motion that ended the
// holder's membership, which a passed motion carries after the exit.
// `account.freezes` checks it froze every account the holder holds; that
// the holder left is the account-membership graft's guard, and that the
// motion passed circle-membership-motion's.
export function freeze(input: Freeze, deps: Deps): Promise<Outcome<(typeof actions)[typeof op], Frozen>> {
  const w: Write<Frozen> = {
    op,
    request: input,
    state: async (tx: Db) => ({ holder: input.holder, accounts: await freezing(tx, input.holder) }),
    payload: (v) => ({ ...v, motion: input.motion }),
  }
  return write(deps, w)
}
