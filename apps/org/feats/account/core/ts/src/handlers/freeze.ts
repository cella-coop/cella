import type { Outcome } from '@cella/org-actions'
import { write, type Db, type Deps, type Write } from '@cella/org-db'
import type { actions } from '../models/actions.ts'
import type { Freeze, Frozen } from '../models/account.ts'

type Op = 'account:account:freeze' | 'account:own:freeze'

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

// The freeze as a write of its own. `account.freezes` checks it froze
// every account the holder holds; that the holder left is the
// account-membership graft's guard.
function frozen<O extends Op>(op: O, input: Freeze, deps: Deps): Promise<Outcome<(typeof actions)[O], Frozen>> {
  const w: Write<Frozen> = {
    op,
    request: input,
    state: async (tx: Db) => ({ holder: input.holder, accounts: await freezing(tx, input.holder) }),
    payload: (v) => ({ ...v, ...(input.motion ? { motion: input.motion } : {}) }),
  }
  return write(deps, w)
}

// The freeze citing the motion that excluded the holder, which a passed
// motion carries after the exclusion; that the motion passed is
// the motion feat's guard, `motion.carried`.
export function freeze(input: Freeze, deps: Deps): Promise<Outcome<(typeof actions)['account:account:freeze'], Frozen>> {
  return frozen('account:account:freeze', input, deps)
}

// The same freeze as the holder's own, once they withdrew by their right,
// citing no motion; that they are the actor is `account.owns`.
export function freezeOwn(input: { holder: string }, deps: Deps): Promise<Outcome<(typeof actions)['account:own:freeze'], Frozen>> {
  return frozen('account:own:freeze', { holder: input.holder }, deps)
}
