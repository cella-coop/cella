import type { Outcome } from '@cella/org-actions'
import { personal, write, type Deps } from '@cella/org-db'
import type { actions } from '@cella/org-account/models'
import { logged, record } from '@cella/org-transaction/api'
import type { Entry } from '@cella/org-transaction/models'
import type { Draw, Drawn } from '../models/draw.ts'

const op = 'account:account:draw' satisfies keyof typeof actions

// A member draws on their own account: the bank pays them, 455 debited
// and 512 credited, on the verdict date, and the draw is theirs.
// `account_membership_transaction.draws` decides: their own, active, not
// frozen, within what is left of their draw limit, and nothing else.
export async function draw(input: Draw, deps: Deps): Promise<Outcome<(typeof actions)[typeof op], Drawn>> {
  // The entry it posts, which its payload keeps for its fold.
  let posting: Entry | null = null
  return write(deps, {
    op,
    request: input,
    state: async (tx) => {
      const { rows } = await tx.query<{ day: string }>(`SELECT to_char(cella.verdict_date(), 'YYYY-MM-DD') AS day`)
      posting = {
        date: rows[0].day,
        label: 'Draw on a member’s account',
        lines: [
          { account: '455', side: 'debit', cents: input.cents, person: input.member },
          { account: '512', side: 'credit', cents: input.cents, person: input.member },
        ],
      }
      const { entry } = await record(tx, posting)
      await tx.query('INSERT INTO account_membership_transaction.draw (entry, member, amount) VALUES ($1, $2, cella.amount($3))', [entry, input.member, input.cents])
      return { member: input.member, amount: input.cents, entry }
    },
    // The amount is the member's capital: the log keeps its commitment,
    // and its lines', which are theirs (`logged`).
    payload: (v) => ({ ...v, amount: personal('account_membership_transaction.draw.amount', v.member, v.amount), ...(posting ? { posting: logged(posting) } : {}) }),
  })
}
