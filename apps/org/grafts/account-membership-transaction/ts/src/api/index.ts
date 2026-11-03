// The graft's writes, reads and slice, which the shell mounts: a member's
// draws and their capital in the books, on their page, and drawing from
// there; their subscription paid in, from the bank or their pay, and,
// once they left, their capital repaid, recording each from there. What
// follows an admission, the subscription, and an exit, the withdrawal,
// are this graft's reactions, each a write of its own after it.
import { action, cents, type Db, type Form, type Slice } from '@cella/org-db'
import { draw } from '../handlers/draw.ts'
import { pay } from '../handlers/pay.ts'
import { repay } from '../handlers/repay.ts'
import { subscribed } from '../handlers/subscribe.ts'
import { withdrawn, withdrawnOwn } from '../handlers/withdraw.ts'
import { account } from '../drivers/draw.ts'
import { called } from '../drivers/capital.ts'

export { draw } from '../handlers/draw.ts'
export { pay } from '../handlers/pay.ts'
export { repay } from '../handlers/repay.ts'
export { subscribe, subscribed, subscribing } from '../handlers/subscribe.ts'
export { withdraw, withdrawing, withdrawn, withdrawnOwn, withdrawOwn } from '../handlers/withdraw.ts'
export { account } from '../drivers/draw.ts'
export { called } from '../drivers/capital.ts'
export type { Called, Payment, Repayment } from '../models/capital.ts'

const theirs = (member: string | undefined) => {
  if (!member) {
    throw new Error('it is on a member’s account')
  }
  return member
}

// The repayment that comes next, which the button pays.
async function next(db: Db, member: string): Promise<number> {
  const { rows } = await db.query<{ n: number | null }>(
    'SELECT min(n) AS n FROM account_membership_transaction.repayment WHERE member = $1 AND paid IS NULL',
    [member],
  )
  if (rows[0]?.n == null) {
    throw new Error(`${member} has no repayment left`)
  }
  return rows[0].n
}

// A member's page: their draws and account, and their capital paid in
// and out.
async function item(db: Db, member: string, actor: string | null) {
  return { ...(await account(db, member, actor)), called: await called(db, member) }
}

export const slice: Slice = {
  name: 'account-membership-transaction',
  extends: {
    people: {
      item,
      actions: {
        draw: action('account:account:draw', (form: Form, id) => ({ member: theirs(id), cents: cents(form.get('amount')) }), draw),
        pay: action('account:capital:pay', (form: Form, id) => ({ member: theirs(id), cents: cents(form.get('amount')) }), pay),
        repay: action('account:capital:repay', async (_form: Form, id, deps) => ({ member: theirs(id), n: await next(deps.db, theirs(id)) }), repay),
      },
    },
  },
  on: {
    'membership:member:admit': subscribed,
    'membership:member:exclude': withdrawn,
    'membership:member:withdraw': withdrawnOwn,
  },
}
