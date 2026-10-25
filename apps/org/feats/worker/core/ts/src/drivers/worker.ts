import type { Db } from '@cella/org-db'
import type { Worker } from '../models/worker.ts'

const columns = `address AS id, address, name, job, contract, to_char(start, 'YYYY-MM-DD') AS start,
  to_char(until, 'YYYY-MM-DD') AS until, (minutes / 60.0)::float8 AS hours, to_char(hired, 'YYYY-MM-DD') AS hired,
  worker.employed(address, cella.verdict_date()) AS employed`

// Every worker, those employed first, by name.
export async function workers(db: Db): Promise<Worker[]> {
  const { rows } = await db.query<Worker>(`SELECT ${columns} FROM worker.worker ORDER BY employed DESC, name`)
  return rows
}

export async function worker(db: Db, address: string): Promise<Worker | null> {
  const { rows } = await db.query<Worker>(`SELECT ${columns} FROM worker.worker WHERE address = $1`, [address])
  return rows[0] ?? null
}

// The day a new hire starts unless the manager says otherwise.
export async function today(db: Db): Promise<{ today: string }> {
  const { rows } = await db.query<{ today: string }>(`SELECT to_char(cella.verdict_date(), 'YYYY-MM-DD') AS today`)
  return rows[0]
}
