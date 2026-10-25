import type { Db, Read } from '@cella/org-db'
import type { Terms } from '../models/terms.ts'

const columns = `t.id, t."from", cella.cents(t.share)::float8 AS share, t.minimum, t.instalments, t.delay, t.repayments,
  to_char(t.adopted, 'YYYY-MM-DD') AS adopted`

// The statutes' capital clauses, the latest year first, drafts before
// adopted, each adopted or drafted as its badge shows it.
export const terms: Read = {
  sql: `SELECT ${columns}, CASE WHEN t.adopted IS NULL THEN 'drafted' ELSE 'adopted' END AS state FROM account.terms t`,
  order: '"from" DESC, adopted DESC NULLS FIRST, id',
}

export async function term(db: Db, id: string): Promise<Terms | null> {
  const { rows } = await db.query<Terms>(`SELECT ${columns} FROM account.terms t WHERE t.id = $1`, [id])
  return rows[0] ?? null
}
