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
export async function subscribed(db: Db): Promise<Record<string, { capital: number }>> {
  const { rows } = await db.query<{ member: string; subscribed: string }>('SELECT member, subscribed FROM account_membership.capital')
  return Object.fromEntries(rows.map((r) => [r.member, { capital: Number(r.subscribed) }]))
}

// Who holds each capital account, by its code, for the chart.
export async function holders(db: Db): Promise<Record<string, { holder: string }>> {
  const { rows } = await db.query<{ account: string; name: string }>('SELECT account, name FROM account_membership.capital WHERE account IS NOT NULL')
  return Object.fromEntries(rows.map((r) => [r.account, { holder: r.name }]))
}

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
