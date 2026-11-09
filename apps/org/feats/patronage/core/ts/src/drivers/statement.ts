import type { Db, Read } from '@cella/org-db'
import type { Line, Sheet, Statement } from '../models/statement.ts'
import { basis } from './terms.ts'

const columns = `s.id, s.distribution, s.year, s.worker, s.amount::float8 AS amount, s.salary::float8 AS salary,
  s.hours::float8 AS hours, s.equal::float8 AS equal`

// The statements as the collection lists them, the latest year first,
// the largest part first.
export const parts: Read = {
  sql: `SELECT ${columns}, s.circle FROM patronage.statement s`,
  order: 'year DESC, amount DESC, worker',
}

// Each worker's part of each year's work share, the latest year first,
// the largest part first.
export async function statements(db: Db): Promise<Statement[]> {
  const { rows } = await db.query<Statement>(`SELECT ${columns} FROM patronage.statement s ORDER BY s.year DESC, s.amount DESC, s.worker`)
  return rows
}

// A worker's statement for a year: their part by basis, against the
// portion each basis divides and its weight in the year's terms.
export async function statement(db: Db, id: string): Promise<Sheet | null> {
  const { rows } = await db.query<Statement & { approved: string | null; distributed: string | null; terms: string | null }>(
    `SELECT ${columns}, to_char(d.approved, 'YYYY-MM-DD') AS approved, to_char(d.distributed, 'YYYY-MM-DD') AS distributed,
       patronage.terms_for(s.year) AS terms
     FROM patronage.statement s JOIN patronage.distribution d ON d.id = s.distribution WHERE s.id = $1`,
    [id],
  )
  const s = rows[0]
  if (!s) {
    return null
  }
  const lines = await db.query<Line>(
    `SELECT p.basis AS id, p.basis, p.quantity::float8 AS quantity, cella.cents(p.amount)::float8 AS amount,
       patronage.portion(p.distribution, p.basis)::float8 AS portion,
       CASE p.basis WHEN 'salary' THEN t.salary WHEN 'hours' THEN t.hours ELSE t.equal END::float8 AS weight
     FROM patronage.part p LEFT JOIN patronage.terms t ON t.id = $3
     WHERE p.distribution = $1 AND p.worker = $2
     ORDER BY array_position(ARRAY['salary', 'hours', 'equal'], p.basis)`,
    [s.distribution, s.worker, s.terms],
  )
  const { terms: ref, ...rest } = s
  return { ...rest, terms: ref ? await basis(db, ref) : null, lines: lines.rows }
}
