import type { Db } from '@cella/org-db'
import type { Detail, Distribution, Share } from '../models/distribution.ts'

const columns = `d.id, d.year, cella.cents(d.surplus)::float8 AS surplus, d.basis,
  to_char(d.approved, 'YYYY-MM-DD') AS approved, to_char(d.distributed, 'YYYY-MM-DD') AS distributed,
  patronage.share_of(d.id, 'work')::float8 AS work, patronage.share_of(d.id, 'legal')::float8 AS legal,
  patronage.share_of(d.id, 'development')::float8 AS development, patronage.share_of(d.id, 'interest')::float8 AS interest`

// Each year's distribution and its split, the latest year first.
export async function distributions(db: Db): Promise<Distribution[]> {
  const { rows } = await db.query<Distribution>(`SELECT ${columns} FROM patronage.distribution d ORDER BY d.year DESC`)
  return rows
}

export async function distribution(db: Db, id: string): Promise<Detail | null> {
  const { rows } = await db.query<Distribution>(`SELECT ${columns} FROM patronage.distribution d WHERE d.id = $1`, [id])
  if (!rows[0]) {
    return null
  }
  const shares = await db.query<Share>(
    `SELECT kind AS id, kind, percent::float8 AS percent, cella.cents(amount)::float8 AS amount
     FROM patronage.share WHERE distribution = $1
     ORDER BY array_position(ARRAY['work', 'legal', 'development', 'interest'], kind)`,
    [id],
  )
  return { ...rows[0], shares: shares.rows }
}
