import type { Db, Read } from '@cella/org-db'
import type { Terms } from '../models/terms.ts'

const columns = `t.id, t.policy, to_char(t."from", 'YYYY-MM-DD') AS "from", cella.cents(t.share)::float8 AS share, t.minimum,
  t.instalments, t.delay, t.repayments, to_char(t.adopted, 'YYYY-MM-DD') AS adopted`

// The statutes' capital clauses, the latest to apply first, each governing
// or replaced as its badge shows it.
export const terms: Read = {
  sql: `SELECT ${columns}, t.circle, CASE WHEN t.id = account.capital_for(cella.verdict_date()) THEN 'governing'
          WHEN t."from" > cella.verdict_date() THEN 'to apply' ELSE 'replaced' END AS state
        FROM account.terms t`,
  order: '"from" DESC, adopted DESC, id',
}

export async function term(db: Db, id: string): Promise<Terms | null> {
  const { rows } = await db.query<Terms>(`SELECT ${columns} FROM account.terms t WHERE t.id = $1`, [id])
  return rows[0] ?? null
}
