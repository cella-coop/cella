import type { Outcome } from '@cella/org-actions'
import { personal, write, type Db, type Deps, type Write } from '@cella/org-db'
import type { actions } from '../models/actions.ts'
import type { Ran, Run } from '../models/payslip.ts'

type Action = keyof typeof actions
type Out<O extends Action, T> = Promise<Outcome<(typeof actions)[O], T>>

// The run's day of this write, how many payslips it holds and their gross.
async function ran(tx: Db, month: string, day: string | undefined): Promise<Ran> {
  const { rows } = await tx.query<{ payslips: string; gross: string }>(
    'SELECT count(*) AS payslips, coalesce(sum(cella.cents(gross)), 0) AS gross FROM payslip.payslip WHERE month = $1',
    [month],
  )
  return { month, day: day ?? '', payslips: Number(rows[0].payslips), gross: Number(rows[0].gross) }
}

// Each payslip's figures as the payload commits to them, its member the
// subject, so the log keeps a salted digest of every member's pay.
const columns = ['gross', 'employee', 'employer', 'net'] as const
type Figures = Record<string, unknown>[]

async function figures(tx: Db, month: string): Promise<Figures> {
  const { rows } = await tx.query<Record<(typeof columns)[number] | 'member', string>>(
    `SELECT member, cella.cents(gross) AS gross, cella.cents(employee) AS employee, cella.cents(employer) AS employer, cella.cents(net) AS net
     FROM payslip.payslip WHERE month = $1 ORDER BY member`,
    [month],
  )
  return rows.map((p) => ({
    member: p.member,
    ...Object.fromEntries(columns.map((c) => [c, personal(`payslip.payslip.${c}`, p.member, Number(p[c]))])),
  }))
}

// Prepares a month's run on the verdict date: one payslip for each
// salaried member, what `payslip.due` says they are due, each one's
// figures committed to in the payload beside the run's totals. The
// payslip-timesheet graft wraps it with the hours of their approved
// months, which it requires.
export const generating = (input: Run): Write<Ran> => {
  let payslips: Figures = []
  return {
    op: 'payslip:run:generate' satisfies Action,
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
      payslips = await figures(tx, input.month)
      return ran(tx, input.month, rows[0]?.day)
    },
    payload: (v) => ({ ...v, figures: payslips }),
  }
}

export async function generate(input: Run, deps: Deps): Out<'payslip:run:generate', Ran> {
  return write(deps, generating(input))
}

// Sets the minutes each payslip of a month's run was worked, inside the
// write that generates it, and returns their sum: what a graft that times
// the run, as payslip-timesheet does from approved months, gives it. A
// member the run holds no payslip of is passed over.
export async function timing(tx: Db, month: string, minutes: { member: string; minutes: number }[]): Promise<number> {
  const { rows } = await tx.query<{ minutes: string }>(
    `WITH timed AS (
       UPDATE payslip.payslip p SET minutes = t.minutes
       FROM jsonb_to_recordset($2::jsonb) AS t(member text, minutes integer)
       WHERE p.month = $1 AND p.member = t.member
       RETURNING p.minutes
     )
     SELECT coalesce(sum(minutes), 0) AS minutes FROM timed`,
    [month, JSON.stringify(minutes)],
  )
  return Number(rows[0].minutes)
}

// Approves a run on the verdict date, as the actor. The
// payslip-transaction graft wraps it with the entry accruing its pay.
export const approving = (input: Run, actor: string): Write<Ran> => ({
  op: 'payslip:run:approve' satisfies Action,
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
  op: 'payslip:run:pay' satisfies Action,
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
