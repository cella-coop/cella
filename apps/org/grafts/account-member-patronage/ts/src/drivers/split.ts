import type { Db } from '@cella/org-db'
import type { Named, Statutes } from '../models/split.ts'

// Whose statement it is, by name, when the worker is a member.
export async function named(db: Db, statement: string): Promise<Named | null> {
  const { rows } = await db.query<Named>(
    `SELECT m.address AS member, m.name FROM patronage.statement s JOIN member.member m ON m.address = s.worker WHERE s.id = $1`,
    [statement],
  )
  return rows[0] ?? null
}

// The work share's terms governing the scope's year.
export async function statutes(db: Db): Promise<Statutes | null> {
  const { rows } = await db.query<Statutes>(
    `SELECT t.id AS terms, t.salary::float8 AS salary, t.hours::float8 AS hours, t.equal::float8 AS equal, t.capital::float8 AS capital
     FROM patronage.terms t WHERE t.id = patronage.terms_for(extract(year FROM cella.verdict_date())::integer)`,
  )
  return rows[0] ?? null
}
