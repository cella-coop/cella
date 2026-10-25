import type { Outcome } from '@cella/org-ops'
import { personal, write, type Db, type Deps, type Write } from '@cella/org-db'
import type { ops } from '../models/ops.ts'
import type { Act, Acted, Capture, Captured } from '../models/expense.ts'

type Op = keyof typeof ops
type Out<O extends Op, T> = Promise<Outcome<(typeof ops)[O], T>>

// Captures a member's expense as a draft. `expense.captures` checks it is
// the actor's own and spent on a day that has come; the expense-membership
// graft's trigger that the actor is an active member.
export const capturing = (input: Capture): Write<Captured> => ({
  op: 'expense:expense:capture' satisfies Op,
  request: input,
  state: async (tx) => {
    const { rows } = await tx.query<{ id: string; total: string }>(
      `INSERT INTO expense.expense AS e (member, day, label, category, net, vat, receipt)
       VALUES ($1, $2, $3, $4, cella.amount($5), cella.amount($6), $7)
       RETURNING e.id, expense.total(e) AS total`,
      [input.member, input.day, input.label, input.category, input.net, input.vat, input.receipt],
    )
    return { expense: rows[0].id, member: input.member, day: input.day, category: input.category, amount: Number(rows[0].total) }
  },
  // The label and the receipt are the member's own: the log commits to
  // them, and the vault keeps them.
  payload: (v) => ({
    ...v,
    label: personal('expense.expense.label', input.member, input.label),
    receipt: personal('expense.expense.receipt', input.member, input.receipt ?? null),
  }),
})

export async function capture(input: Capture, deps: Deps): Out<'expense:expense:capture', Captured> {
  return write(deps, capturing(input))
}

// Moves an expense to a status on the verdict date, as the actor, and
// returns its total and the day.
async function move(tx: Db, expense: string, set: string, actor?: string): Promise<Acted> {
  const { rows } = await tx.query<{ total: string; day: string }>(
    `UPDATE expense.expense AS e SET ${set} WHERE e.id = $1
     RETURNING expense.total(e) AS total, to_char(cella.verdict_date(), 'YYYY-MM-DD') AS day`,
    actor ? [expense, actor] : [expense],
  )
  return { expense, amount: Number(rows[0]?.total ?? 0), day: rows[0]?.day ?? '' }
}

// Submits a draft for approval; `expense.submits` checks it is the actor's.
export async function submit(input: Act, deps: Deps): Out<'expense:expense:submit', Acted> {
  return write(deps, {
    op: 'expense:expense:submit' satisfies Op,
    request: input,
    state: (tx) => move(tx, input.expense, `status = 'submitted', submitted = cella.verdict_date()`),
    payload: (v) => ({ ...v }),
  })
}

// Approves a submitted expense, spending the approver's budget for the
// month. The expense-transaction graft wraps it with the entry charging
// it, and the circle-expense-membership graft checks the budget.
export const approving = (input: Act, actor: string): Write<Acted> => ({
  op: 'expense:expense:approve' satisfies Op,
  request: input,
  state: (tx) => move(tx, input.expense, `status = 'approved', decided = cella.verdict_date(), decider = $2`, actor),
  payload: (v) => ({ ...v }),
})

export async function approve(input: Act, deps: Deps): Out<'expense:expense:approve', Acted> {
  return write(deps, approving(input, deps.actor))
}

// Refuses a submitted expense; it posts nothing.
export async function refuse(input: Act, deps: Deps): Out<'expense:expense:refuse', Acted> {
  return write(deps, {
    op: 'expense:expense:refuse' satisfies Op,
    request: input,
    state: (tx) => move(tx, input.expense, `status = 'refused', decided = cella.verdict_date(), decider = $2`, deps.actor),
    payload: (v) => ({ ...v }),
  })
}

// Reimburses an approved expense. The expense-transaction graft wraps it
// with the payment from the bank.
export const reimbursing = (input: Act): Write<Acted> => ({
  op: 'expense:expense:reimburse' satisfies Op,
  request: input,
  state: (tx) => move(tx, input.expense, `status = 'reimbursed', reimbursed = cella.verdict_date()`),
  payload: (v) => ({ ...v }),
})

export async function reimburse(input: Act, deps: Deps): Out<'expense:expense:reimburse', Acted> {
  return write(deps, reimbursing(input))
}
