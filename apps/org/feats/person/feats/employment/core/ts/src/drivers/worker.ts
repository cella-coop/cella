import { literal, type Db } from '@cella/org-db'
import { terms, type Worker } from '../models/worker.ts'

const columns = `w.address AS id, w.address, p.name, w.job, w.contract, to_char(w.start, 'YYYY-MM-DD') AS start,
  to_char(w.until, 'YYYY-MM-DD') AS until, (w.minutes / 60.0)::float8 AS hours, to_char(w.hired, 'YYYY-MM-DD') AS hired,
  employment.employed(w.address, cella.verdict_date()) AS employed`
const from = 'employment.worker w JOIN person.person p ON p.address = w.address'

// Each person's employment, by their address: whether they are a worker
// or a former one on the scope's day, and their contract in words, as
// their chips show them.
export const employments = `SELECT w.address AS id, w.job,
  CASE w.contract ${Object.entries(terms).map(([c, term]) => `WHEN ${literal(c)} THEN ${literal(term)}`).join(' ')} END AS contract,
  to_char(w.start, 'YYYY-MM-DD') AS start, to_char(w.until, 'YYYY-MM-DD') AS until, (w.minutes / 60.0)::float8 AS hours,
  e.employed, CASE WHEN e.employed THEN 'worker' ELSE 'former worker' END AS worker
  FROM employment.worker w, LATERAL (SELECT employment.employed(w.address, cella.verdict_date()) AS employed) e`

export async function worker(db: Db, address: string): Promise<Worker | null> {
  const { rows } = await db.query<Worker>(`SELECT ${columns} FROM ${from} WHERE w.address = $1`, [address])
  return rows[0] ?? null
}

// The day a new hire starts unless the manager says otherwise.
export async function today(db: Db): Promise<{ today: string }> {
  const { rows } = await db.query<{ today: string }>(`SELECT to_char(cella.verdict_date(), 'YYYY-MM-DD') AS today`)
  return rows[0]
}
