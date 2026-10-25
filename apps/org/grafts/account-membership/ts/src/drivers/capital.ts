import type { Db } from '@cella/org-db'
import type { Capital, Rights, Statutes } from '../models/capital.ts'

const columns = `member, name, status, shares, value::float8 AS value, subscribed::float8 AS subscribed, account, frozen,
  allowance::float8 AS allowance`

// A member's capital, or null before the share has a value.
export async function capital(db: Db, member: string): Promise<Capital | null> {
  const { rows } = await db.query<Capital>(`SELECT ${columns} FROM account_membership.capital WHERE member = $1`, [member])
  return rows[0] ?? null
}

// Each member's subscribed capital, by address, for the members list.
export const subscribed = 'SELECT member AS id, subscribed AS capital FROM account_membership.capital'

// Who holds each capital account, by its code, for the chart.
export const holders = 'SELECT account AS id, name AS holder FROM account_membership.capital WHERE account IS NOT NULL'

// The statutes' capital clauses in force on the scope's day.
export async function statutes(db: Db): Promise<Statutes | null> {
  const { rows } = await db.query<Statutes>(
    `SELECT c.id AS terms, cella.cents(c.share)::float8 AS share, c.minimum, c.instalments, c.delay, c.repayments
     FROM account.terms c WHERE c.id = account.capital_for(cella.verdict_date())`,
  )
  return rows[0] ?? null
}

// A member's capital and the statutes their page reads back: what they
// own, and what joining asks of them.
export async function rights(db: Db, member: string): Promise<Rights | null> {
  const c = await capital(db, member)
  return c ? { ...c, statutes: await statutes(db) } : null
}
