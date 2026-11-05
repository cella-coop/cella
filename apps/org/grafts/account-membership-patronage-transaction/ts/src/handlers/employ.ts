import { done, write, type Deps, type Done, type Write } from '@cella/org-db'
import type { actions } from '@cella/org-patronage/models'
import { crediting } from '@cella/org-membership/api'
import { logged, record } from '@cella/org-transaction/api'
import type { Entry } from '@cella/org-transaction/models'
import type { Credited, Employ } from '../models/patronage.ts'

const op = 'patronage:part:employ' satisfies keyof typeof actions

// An associate's part of a distributed split employed in shares, on the
// verdict date: what `account_membership_patronage.split` gives it in
// shares is posted through the journal's `record`, 424 (the work share
// owed) debited and their capital account under 1013 credited, recorded
// as their credit, and added to what they hold by the membership feat's
// `crediting`. Its payload names the distribution, the member, the entry
// and the motion, and keeps the credit and the entry for its fold;
// `account_membership_patronage_transaction.employs` reads the shares
// from the row this write made and decides, the patronage feat's guard
// that the split is distributed, and motion-patronage's that the motion
// approved it.
export function employing(input: Employ): Write<Credited> {
  // The entry it posts, which its payload keeps for its fold.
  let posting: Entry | null = null
  return {
    op,
    request: input,
    state: async (tx) => {
      const { rows } = await tx.query<{ day: string; year: number; shares: number; capital: string; until: string; account: string | null }>(
        `SELECT to_char(cella.verdict_date(), 'YYYY-MM-DD') AS day, p.year, p.shares, p.capital, to_char(p.until, 'YYYY-MM-DD') AS until,
                (SELECT min(a.code) FROM account.account a WHERE a.holder = p.worker AND a.parent = '1013' AND NOT a.frozen) AS account
         FROM account_membership_patronage.split p
         WHERE p.distribution = $1 AND p.worker = $2 AND p.shares > 0`,
        [input.distribution, input.member],
      )
      const p = rows[0]
      const { rows: credited } = await tx.query(
        'SELECT 1 FROM account_membership_patronage_transaction.credit WHERE distribution = $1 AND member = $2',
        [input.distribution, input.member],
      )
      if (credited.length) {
        throw new Error(`${input.member} was credited the shares of their part of ${input.distribution} already`)
      }
      if (!p || !p.account) {
        throw new Error(`${input.member}'s part of ${input.distribution} buys no shares`)
      }
      const cents = Number(p.capital)
      posting = {
        date: p.day,
        label: `Work share ${p.year} employed in shares, ${p.account}`,
        lines: [
          { account: '424', side: 'debit', cents },
          { account: p.account, side: 'credit', cents },
        ],
      }
      const { entry } = await record(tx, posting)
      await tx.query(
        `INSERT INTO account_membership_patronage_transaction.credit (distribution, member, account, shares, amount, until, entry)
         VALUES ($1, $2, $3, $4, cella.amount($5), $6, $7)`,
        [input.distribution, input.member, p.account, p.shares, cents, p.until, entry],
      )
      const holds = await crediting(tx, input.member, p.shares)
      return { ...input, account: p.account, shares: p.shares, amount: cents, until: p.until, entry, holds }
    },
    payload: (v) => ({
      distribution: v.distribution,
      member: v.member,
      entry: v.entry,
      motion: v.motion,
      account: v.account,
      shares: v.shares,
      amount: v.amount,
      until: v.until,
      ...(posting ? { posting: logged(posting) } : {}),
    }),
  }
}

export function employ(input: Employ, deps: Deps) {
  return write(deps, employing(input))
}

// What follows a distribution: each associate whose part buys shares
// credited them, in turn, each a write of its own signed by whoever
// signed the distribution, the member who approved the split, and citing
// the same motion. A refused one leaves the distribution and every credit
// before it settled, and says why. Where no part buys a share, no write
// is made.
export async function credited(request: unknown, deps: Deps): Promise<Done[]> {
  const { distribution, motion } = request as { distribution: string; motion: string }
  const { rows } = await deps.db.query<{ member: string }>('SELECT member FROM account_membership_patronage_transaction.employable($1)', [distribution])
  const out: Done[] = []
  for (const { member } of rows) {
    out.push(done(op, await employ({ distribution, member, motion }, deps)))
  }
  return out
}
