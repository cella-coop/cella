import type { Db } from '@cella/org-db'
import type { Claim, Claimed } from '../models/claim.ts'

// Each expense's member and decider, by name, by the expense's id.
export async function claims(db: Db): Promise<Record<string, Claimed>> {
  const { rows } = await db.query<Claimed & { expense: string }>('SELECT expense, name, decider_name FROM expense_member.claim')
  return Object.fromEntries(rows.map((r) => [r.expense, { name: r.name, decider_name: r.decider_name }]))
}

export async function claim(db: Db, expense: string): Promise<Claimed | null> {
  const { rows } = await db.query<Claimed>('SELECT name, decider_name FROM expense_member.claim WHERE expense = $1', [expense])
  return rows[0] ?? null
}

// A member's expenses, the latest first.
export async function claimed(db: Db, member: string): Promise<Claim[]> {
  const { rows } = await db.query<Claim>(
    `SELECT e.id, e.label, to_char(e.day, 'YYYY-MM-DD') AS day, expense.total(e)::float8 AS total, e.status
     FROM expense.expense e WHERE e.member = $1 ORDER BY e.day DESC, e.id DESC`,
    [member],
  )
  return rows
}
