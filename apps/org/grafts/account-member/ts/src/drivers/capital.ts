import type { Db } from '@cella/org-db'
import type { Capital, Held, Owed, Rights, Statutes } from '../models/capital.ts'

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

// The statutes' terms in force on the scope's day: those governing this
// year's work share, and those whose capital clauses govern the day.
export async function statutes(db: Db): Promise<Statutes | null> {
  const { rows } = await db.query<Statutes>(
    `SELECT w.id AS terms, w.salary::float8 AS salary, w.hours::float8 AS hours, w.equal::float8 AS equal, w.capital::float8 AS capital,
            cella.cents(c.share)::float8 AS share, c.minimum, c.instalments, c.delay, c.repayments
     FROM account.terms w
     LEFT JOIN account.terms c ON c.id = account.capital_for(cella.verdict_date())
     WHERE w.id = account.terms_for(extract(year FROM cella.verdict_date())::integer)`,
  )
  return rows[0] ?? null
}

// A member's capital, their statements for themselves, and the statutes
// their page reads back: what they own, and what joining asks of them.
export async function rights(db: Db, member: string, actor: string | null): Promise<Rights | null> {
  const h = await held(db, member, actor)
  return h ? { ...h, statutes: await statutes(db) } : null
}
