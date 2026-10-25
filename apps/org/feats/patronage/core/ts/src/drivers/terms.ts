import type { Db } from '@cella/org-db'
import type { Terms } from '../models/terms.ts'

const columns = `t.id, t."from", t.salary::float8 AS salary, t.hours::float8 AS hours, t.equal::float8 AS equal,
  t.capital::float8 AS capital, t.interest::float8 AS interest, to_char(t.adopted, 'YYYY-MM-DD') AS adopted, patronage.basis_of(t.id) AS basis`

// The statutes' terms for the work share, the latest year first, drafts
// before adopted.
export async function bases(db: Db): Promise<Terms[]> {
  const { rows } = await db.query<Terms>(`SELECT ${columns} FROM patronage.terms t ORDER BY t."from" DESC, t.adopted DESC NULLS FIRST, t.id`)
  return rows
}

export async function basis(db: Db, id: string): Promise<Terms | null> {
  const { rows } = await db.query<Terms>(`SELECT ${columns} FROM patronage.terms t WHERE t.id = $1`, [id])
  return rows[0] ?? null
}
