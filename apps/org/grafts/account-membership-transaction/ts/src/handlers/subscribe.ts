import type { Outcome } from '@cella/org-actions'
import { done, write, type Deps, type Done, type Write } from '@cella/org-db'
import type { actions } from '@cella/org-account/models'
import { holding } from '@cella/org-account/api'
import { record } from '@cella/org-transaction/api'
import type { Subscribe, Subscribed } from '../models/capital.ts'

const op = 'account:capital:subscribe' satisfies keyof typeof actions

// A member admitted subscribes their shares, on the verdict date: their
// capital account opens under 1013, next in the chart, by the account
// feat's `holding`, and their shares at the share's value are called,
// 4562 debited and 1012 credited, through the journal's `record`.
// `account_membership_transaction.subscribes` decides: they are active,
// hold at least the statutes' minimum, and the entry is exactly the
// subscription; account-transaction's guard, that the month is open.
export function subscribing(input: Subscribe): Write<Subscribed> {
  return {
    op,
    request: input,
    state: async (tx) => {
      const { rows } = await tx.query<{ day: string; shares: number; name: string; value: string | null }>(
        `SELECT to_char(cella.verdict_date(), 'YYYY-MM-DD') AS day, m.shares, p.name,
                account_membership.value(cella.verdict_date()) AS value
         FROM membership.member m JOIN person.person p ON p.address = m.address
         WHERE m.address = $1`,
        [input.member],
      )
      const m = rows[0]
      // Nothing prices their shares: nothing is written, and the guard
      // refuses, saying what is missing.
      if (!m || m.value === null || m.shares === 0) {
        return { member: input.member, account: '', shares: m?.shares ?? 0, amount: 0, entry: '' }
      }
      const cents = m.shares * Number(m.value)
      const account = await holding(tx, { holder: input.member, parent: '1013', label: `Capital — ${m.name}` })
      const { entry } = await record(tx, {
        date: m.day,
        label: `Capital subscribed and called, ${account}`,
        lines: [
          { account: '4562', side: 'debit', cents },
          { account: '1012', side: 'credit', cents },
        ],
      })
      await tx.query(
        `INSERT INTO account_membership_transaction.subscription (member, account, shares, entry, amount)
         VALUES ($1, $2, $3, $4, cella.amount($5))`,
        [input.member, account, m.shares, entry, cents],
      )
      return { member: input.member, account, shares: m.shares, amount: cents, entry }
    },
    payload: (v) => ({ ...v, motion: input.motion }),
  }
}

export async function subscribe(input: Subscribe, deps: Deps): Promise<Outcome<(typeof actions)[typeof op], Subscribed>> {
  return write(deps, subscribing(input))
}

// What follows an admission, whichever write admits: the member's
// subscription, an effect in the admission's transaction citing it, and
// one the admission requires, so a subscription refused forgoes the
// admission with it. Where no adopted terms value a share on the verdict
// date, the subscription writes nothing and its guard refuses it.
export async function subscribed(request: unknown, deps: Deps): Promise<Done[]> {
  const { member, motion } = request as { member: string; motion: string }
  return [done(op, await subscribe({ member, motion }, deps))]
}
