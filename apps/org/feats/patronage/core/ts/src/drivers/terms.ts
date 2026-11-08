import { literal, type Db, type Read } from '@cella/org-db'
import { divides, type Terms } from '../models/terms.ts'

const fields = (basis: string) => `t.id, t.policy, t."from", t.salary::float8 AS salary, t.hours::float8 AS hours, t.equal::float8 AS equal,
  t.capital::float8 AS capital, t.interest::float8 AS interest, to_char(t.adopted, 'YYYY-MM-DD') AS adopted, ${basis} AS basis`
const columns = fields('patronage.basis_of(t.id)')

// How terms divide the work share, as the list shows it: by what, then
// each weight above nothing, as `by a mix: 50 % pay, 50 % time worked`.
const division = `CASE patronage.basis_of(t.id) ${Object.entries(divides).map(([b, l]) => `WHEN ${literal(b)} THEN ${literal(l)}`).join(' ')} END || ': ' || concat_ws(', ',
  CASE WHEN t.salary > 0 THEN t.salary::float8 || ' % pay' END,
  CASE WHEN t.hours > 0 THEN t.hours::float8 || ' % time worked' END,
  CASE WHEN t.equal > 0 THEN t.equal::float8 || ' % equal parts' END)`

// The statutes' terms for the work share, the latest year first, each
// with how it divides, and governing this year, to govern a later one or
// replaced, as the list shows them.
export const bases: Read = {
  sql: `SELECT ${fields(division)}, t.circle, CASE WHEN t.id = patronage.terms_for(extract(year FROM cella.verdict_date())::integer) THEN 'governing'
          WHEN t."from" > extract(year FROM cella.verdict_date()) THEN 'to govern' ELSE 'replaced' END AS state FROM patronage.terms t`,
  order: '"from" DESC, adopted DESC, id',
}

export async function basis(db: Db, id: string): Promise<Terms | null> {
  const { rows } = await db.query<Terms>(`SELECT ${columns} FROM patronage.terms t WHERE t.id = $1`, [id])
  return rows[0] ?? null
}
