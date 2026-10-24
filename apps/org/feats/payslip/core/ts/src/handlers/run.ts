import type { Outcome } from '@cella/org-ops'
import { write, type Db, type Deps, type Write } from '@cella/org-db'
import type { ops } from '../models/ops.ts'
import type { Ran, Run } from '../models/payslip.ts'

type Op = keyof typeof ops
type Out<O extends Op, T> = Promise<Outcome<(typeof ops)[O], T>>

// The run's day of this write, how many payslips it holds and their gross.
async function ran(tx: Db, month: string, day: string | undefined): Promise<Ran> {
  const { rows } = await tx.query<{ payslips: string; gross: string }>(
    'SELECT count(*) AS payslips, coalesce(sum(cella.cents(gross)), 0) AS gross FROM payslip.payslip WHERE month = $1',
    [month],
  )
  return { month, day: day ?? '', payslips: Number(rows[0].payslips), gross: Number(rows[0].gross) }
}

// Prepares a month's run on the verdict date: one payslip for each
// salaried member, what `payslip.due` says they are due. The
// payslip-timesheet graft wraps it with the hours of their approved
// months, which it requires.
export const generating = (input: Run): Write<Ran> => ({
  op: 'payslip:run:generate' satisfies Op,
  request: input,
  state: async (tx) => {
    const { rows } = await tx.query<{ day: string }>(
      `INSERT INTO payslip.run (month, generated) VALUES ($1, cella.verdict_date()) RETURNING to_char(generated, 'YYYY-MM-DD') AS day`,
      [input.month],
    )
    await tx.query(
      `INSERT INTO payslip.payslip (month, member, gross, employee, employer, net)
       SELECT $1, d.member, cella.amount(d.gross), cella.amount(d.employee), cella.amount(d.employer), cella.amount(d.net)
       FROM payslip.due($1) d`,
      [input.month],
    )
    return ran(tx, input.month, rows[0]?.day)
  },
  payload: (v) => ({ ...v }),
})

export async function generate(input: Run, deps: Deps): Out<'payslip:run:generate', Ran> {
  return write(deps, generating(input))
}

// Approves a run on the verdict date, as the actor. The
// payslip-transaction graft wraps it with the entry accruing its pay.
export const approving = (input: Run, actor: string): Write<Ran> => ({
  op: 'payslip:run:approve' satisfies Op,
  request: input,
  state: async (tx) => {
    const { rows } = await tx.query<{ day: string }>(
      `UPDATE payslip.run SET approved = cella.verdict_date(), approver = $2 WHERE month = $1
       RETURNING to_char(approved, 'YYYY-MM-DD') AS day`,
      [input.month, actor],
    )
    return ran(tx, input.month, rows[0]?.day)
  },
  payload: (v) => ({ ...v }),
})

export async function approve(input: Run, deps: Deps): Out<'payslip:run:approve', Ran> {
  return write(deps, approving(input, deps.actor))
}

// Pays an approved run on the verdict date. The payslip-transaction graft
// wraps it with the payment from the bank.
export const paying = (input: Run): Write<Ran> => ({
  op: 'payslip:run:pay' satisfies Op,
  request: input,
  state: async (tx) => {
    const { rows } = await tx.query<{ day: string }>(
      `UPDATE payslip.run SET paid = cella.verdict_date() WHERE month = $1 RETURNING to_char(paid, 'YYYY-MM-DD') AS day`,
      [input.month],
    )
    return ran(tx, input.month, rows[0]?.day)
  },
  payload: (v) => ({ ...v }),
})

export async function pay(input: Run, deps: Deps): Out<'payslip:run:pay', Ran> {
  return write(deps, paying(input))
}
