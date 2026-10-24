// The graft's reads and its slice, which the shell mounts: how a surplus's
// work share divides among the members by what each was paid that year.
import type { Db, Slice } from '@cella/org-db'

export interface Part {
  id: string
  member: string
  basis: number
  amount: number
}

export async function parts(db: Db, allocation: string): Promise<Part[]> {
  const { rows } = await db.query<Part>(
    `SELECT member AS id, member, basis::float8 AS basis, amount::float8 AS amount
     FROM account_payslip.work_share WHERE allocation = $1 ORDER BY amount DESC, member`,
    [allocation],
  )
  return rows
}

export const slice: Slice = {
  name: 'account-payslip',
  extends: {
    allocations: { item: parts },
  },
}
