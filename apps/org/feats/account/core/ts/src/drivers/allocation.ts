import type { Db } from '@cella/org-db'
import type { Allocation, Detail, Part } from '../models/allocation.ts'

const columns = `a.id, a.year, cella.cents(a.surplus)::float8 AS surplus, a.basis, to_char(a.allocated, 'YYYY-MM-DD') AS allocated,
  account.share_of(a.id, 'work')::float8 AS work, account.share_of(a.id, 'legal')::float8 AS legal,
  account.share_of(a.id, 'development')::float8 AS development, account.share_of(a.id, 'interest')::float8 AS interest`

// Each year's surplus and its split, the latest year first.
export async function allocations(db: Db): Promise<Allocation[]> {
  const { rows } = await db.query<Allocation>(`SELECT ${columns} FROM account.allocation a ORDER BY a.year DESC`)
  return rows
}

export async function allocation(db: Db, id: string): Promise<Detail | null> {
  const { rows } = await db.query<Allocation>(`SELECT ${columns} FROM account.allocation a WHERE a.id = $1`, [id])
  if (!rows[0]) {
    return null
  }
  const shares = await db.query<Part>(
    `SELECT kind AS id, kind, percent::float8 AS percent, cella.cents(amount)::float8 AS amount
     FROM account.share WHERE allocation = $1
     ORDER BY array_position(ARRAY['work', 'legal', 'development', 'interest'], kind)`,
    [id],
  )
  return { ...rows[0], shares: shares.rows }
}
