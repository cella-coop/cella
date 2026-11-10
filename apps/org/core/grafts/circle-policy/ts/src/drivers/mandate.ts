import type { Db } from '@cella/org-db'
import { sentences } from '@cella/org-policy'
import type { Worded } from '../models/index.ts'

// A mandate's policy: its sentence as it reads, from the register, and the
// motion that adopted it; or null where the reader reads no such mandate.
export async function worded(db: Db, id: string): Promise<Worded | null> {
  if (!/^\d+$/.test(id)) {
    return null
  }
  const { rows } = await db.query<{ policy: string; motion: string | null }>(
    'SELECT m.policy, p.motion FROM circle.mandate m LEFT JOIN policy.policy p ON p.id = m.policy WHERE m.id = $1',
    [id],
  )
  const m = rows[0]
  if (!m) {
    return null
  }
  const read = await sentences(db, [m.policy])
  return { ...m, sentence: read.get(m.policy) ?? m.policy }
}
