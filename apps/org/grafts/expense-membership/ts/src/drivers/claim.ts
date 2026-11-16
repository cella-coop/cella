import type { Db } from '@cella/org-db'
import type { Claimed } from '../models/claim.ts'

// Each expense's member and decider, by name, by the expense's id.
export const claims = 'SELECT expense AS id, name, decider_name FROM expense_membership.claim'

export async function claim(db: Db, expense: string): Promise<Claimed | null> {
  const { rows } = await db.query<Claimed>('SELECT name, decider_name FROM expense_membership.claim WHERE expense = $1', [expense])
  return rows[0] ?? null
}
