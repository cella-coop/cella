import type { Db } from '@cella/org-db'
import type { Line, Sheet, Statement } from '../models/statement.ts'
import { term } from './terms.ts'

const columns = `s.id, s.allocation, s.year, s.worker, s.amount::float8 AS amount, s.salary::float8 AS salary,
  s.hours::float8 AS hours, s.equal::float8 AS equal`

// Each worker's part of each year's work share, the latest year first,
// the largest part first.
export async function statements(db: Db): Promise<Statement[]> {
  const { rows } = await db.query<Statement>(`SELECT ${columns} FROM account.statement s ORDER BY s.year DESC, s.amount DESC, s.worker`)
  return rows
}

// A worker's statement for a year: their part by basis, against the
// portion each basis divides and its weight in the year's terms.
export async function statement(db: Db, id: string): Promise<Sheet | null> {
  const { rows } = await db.query<Statement & { allocated: string | null; terms: string | null }>(
    `SELECT ${columns}, to_char(a.allocated, 'YYYY-MM-DD') AS allocated, account.terms_for(s.year) AS terms
     FROM account.statement s JOIN account.allocation a ON a.id = s.allocation WHERE s.id = $1`,
    [id],
  )
  const s = rows[0]
  if (!s) {
    return null
  }
  const lines = await db.query<Line>(
    `SELECT p.basis AS id, p.basis, p.quantity::float8 AS quantity, cella.cents(p.amount)::float8 AS amount,
       account.portion(p.allocation, p.basis)::float8 AS portion,
       CASE p.basis WHEN 'salary' THEN t.salary WHEN 'hours' THEN t.hours ELSE t.equal END::float8 AS weight
     FROM account.part p LEFT JOIN account.terms t ON t.id = $3
     WHERE p.allocation = $1 AND p.worker = $2
     ORDER BY array_position(ARRAY['salary', 'hours', 'equal'], p.basis)`,
    [s.allocation, s.worker, s.terms],
  )
  const { terms: ref, ...rest } = s
  return { ...rest, terms: ref ? await term(db, ref) : null, lines: lines.rows }
}
