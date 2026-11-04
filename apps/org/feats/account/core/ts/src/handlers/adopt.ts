import type { Outcome } from '@cella/org-actions'
import { write, type Deps } from '@cella/org-db'
import type { actions } from '../models/actions.ts'
import type { Adopt, Adopted } from '../models/terms.ts'

const op = 'account:terms:adopt' satisfies keyof typeof actions

// Copies the capital rule a passed motion adopted into the terms its
// values make, on the verdict date, citing the motion: account-motion
// carries it once the adoption settles. The guards decide:
// `account.adopts` that the terms are what the rule marks and repay an
// exit within five years, the account-motion graft's that the motion
// adopted the rule, and membership-motion's that it passed.
// Adopted terms never change.
export async function adopt(input: Adopt, deps: Deps): Promise<Outcome<(typeof actions)[typeof op], Adopted>> {
  return write(deps, {
    op,
    request: input,
    state: async (tx) => {
      const made = await tx.query<{ terms: string | null }>('SELECT account.terms_from($1) AS terms', [input.policy])
      const terms = made.rows[0]?.terms ?? ''
      const { rows } = await tx.query<{ adopted: string }>(`SELECT to_char(adopted, 'YYYY-MM-DD') AS adopted FROM account.terms WHERE id = $1`, [terms])
      return { ...input, terms, adopted: rows[0]?.adopted ?? '' }
    },
    payload: (v) => ({ ...v }),
  })
}
