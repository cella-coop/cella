import type { Db } from '@cella/org-db'
import type { Terms } from '../models/terms.ts'

const columns = `t.id, t."from", t.salary::float8 AS salary, t.hours::float8 AS hours, t.equal::float8 AS equal,
  t.capital::float8 AS capital, cella.cents(t.share)::float8 AS share, t.minimum, t.instalments, t.delay, t.repayments,
  to_char(t.adopted, 'YYYY-MM-DD') AS adopted, account.basis_of(t.id) AS basis`

// The statutes' terms, the latest year first, drafts before adopted.
export async function terms(db: Db): Promise<Terms[]> {
  const { rows } = await db.query<Terms>(`SELECT ${columns} FROM account.terms t ORDER BY t."from" DESC, t.adopted DESC NULLS FIRST, t.id`)
  return rows
}

export async function term(db: Db, id: string): Promise<Terms | null> {
  const { rows } = await db.query<Terms>(`SELECT ${columns} FROM account.terms t WHERE t.id = $1`, [id])
  return rows[0] ?? null
}
