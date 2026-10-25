import type { Db } from '@cella/org-db'
import type { Capital, Held, Owed } from '../models/capital.ts'

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

// A member's statements, the latest year first, for the member alone: a
// member's part of the work share is payroll, theirs to see on their own
// page; finance reads every statement in the collection.
export async function owed(db: Db, member: string, actor: string | null): Promise<Owed[]> {
  if (actor !== member) {
    return []
  }
  const { rows } = await db.query<Owed>(
    `SELECT allocation || ':' || worker AS id, allocation, year, part::float8 AS part, shares, capital::float8 AS capital, cash::float8 AS cash
     FROM account_member.patronage WHERE worker = $1 ORDER BY year DESC`,
    [member],
  )
  return rows
}

// A member's capital and, for themselves, their statements.
export async function held(db: Db, member: string, actor: string | null): Promise<Held | null> {
  const c = await capital(db, member)
  return c ? { ...c, statements: await owed(db, member, actor) } : null
}

// Whose statement it is, by name, when the worker is a member.
export async function named(db: Db, statement: string): Promise<{ member: string; name: string } | null> {
  const { rows } = await db.query<{ member: string; name: string }>(
    `SELECT m.address AS member, m.name FROM account.statement s JOIN member.member m ON m.address = s.worker WHERE s.id = $1`,
    [statement],
  )
  return rows[0] ?? null
}
