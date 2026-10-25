import type { Db } from '@cella/org-db'
import type { Posted } from '../models/posted.ts'

export async function posted(db: Db, distribution: string): Promise<Posted> {
  const { rows } = await db.query<Posted>(
    `SELECT p.entry, d.approved IS NOT NULL AS approved, d.distributed IS NOT NULL AS distributed
     FROM patronage.distribution d LEFT JOIN patronage_transaction.distribution p ON p.distribution = d.id
     WHERE d.id = $1`,
    [distribution],
  )
  return rows[0] ?? { entry: null, approved: false, distributed: false }
}
