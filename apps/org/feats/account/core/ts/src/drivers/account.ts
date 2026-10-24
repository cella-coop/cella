import type { Db } from '@cella/org-db'
import type { Account, Period } from '../models/account.ts'

const columns = 'code AS id, code, label, kind, parent, holder, frozen, cash'

// The chart, by code as text, so classes read in order: 1 before 4 before 6.
export async function accounts(db: Db): Promise<Account[]> {
  const { rows } = await db.query<Account>(`SELECT ${columns} FROM account.account ORDER BY code`)
  return rows
}

export async function account(db: Db, code: string): Promise<Account | null> {
  const { rows } = await db.query<Account>(`SELECT ${columns} FROM account.account WHERE code = $1`, [code])
  return rows[0] ?? null
}

// The latest month first.
export async function periods(db: Db): Promise<Period[]> {
  const { rows } = await db.query<Period>(`SELECT month AS id, month, to_char(closed, 'YYYY-MM-DD') AS closed FROM account.period ORDER BY month DESC`)
  return rows
}

export async function period(db: Db, month: string): Promise<Period | null> {
  const { rows } = await db.query<Period>(
    `SELECT month AS id, month, to_char(closed, 'YYYY-MM-DD') AS closed FROM account.period WHERE month = $1`,
    [month],
  )
  return rows[0] ?? null
}
