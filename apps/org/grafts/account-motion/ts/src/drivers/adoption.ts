import type { Db } from '@cella/org-db'
import type { Adoption } from '../models/adoption.ts'

const columns = `a.motion AS id, a.terms, t."from", a.motion, d.title, to_char(d.closed, 'YYYY-MM-DD') AS closed,
  to_char(t.adopted, 'YYYY-MM-DD') AS adopted`
const from = `FROM account_motion.adoption a
  JOIN account.terms t ON t.id = a.terms
  JOIN motion.motion d ON d.id = a.motion`

// The motions moving to adopt terms, or the terms a motion moves to
// adopt.
export async function adoptions(db: Db, by: { terms: string } | { motion: string }): Promise<Adoption[]> {
  const [where, value] = 'terms' in by ? ['a.terms', by.terms] : ['a.motion', by.motion]
  const { rows } = await db.query<Adoption>(`SELECT ${columns} ${from} WHERE ${where} = $1 ORDER BY d.proposed DESC`, [value])
  return rows
}

// The drafted terms a new motion may move to adopt, as its New form
// offers them.
export async function drafted(db: Db): Promise<{ value: string; label: string }[]> {
  const { rows } = await db.query<{ value: string; label: string }>(
    `SELECT t.id AS value, t.id || ', from ' || t."from" AS label FROM account.terms t WHERE t.adopted IS NULL ORDER BY t."from", t.id`,
  )
  return rows
}
