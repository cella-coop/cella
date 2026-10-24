import type { Db } from '@cella/org-db'
import type { Capital } from '../models/capital.ts'

const columns = `member, name, status, shares, value::float8 AS value, subscribed::float8 AS subscribed, account, frozen,
  allowance::float8 AS allowance`

// A member's capital, or null before the share has a value.
export async function capital(db: Db, member: string): Promise<Capital | null> {
  const { rows } = await db.query<Capital>(`SELECT ${columns} FROM account_member.capital WHERE member = $1`, [member])
  return rows[0] ?? null
}

// Each member's subscribed capital, by address, for the members list.
export async function subscribed(db: Db): Promise<Record<string, { capital: number }>> {
  const { rows } = await db.query<{ member: string; subscribed: string }>('SELECT member, subscribed FROM account_member.capital')
  return Object.fromEntries(rows.map((r) => [r.member, { capital: Number(r.subscribed) }]))
}

// Who holds each capital account, by its code, for the chart.
export async function holders(db: Db): Promise<Record<string, { holder: string }>> {
  const { rows } = await db.query<{ account: string; name: string }>('SELECT account, name FROM account_member.capital WHERE account IS NOT NULL')
  return Object.fromEntries(rows.map((r) => [r.account, { holder: r.name }]))
}
