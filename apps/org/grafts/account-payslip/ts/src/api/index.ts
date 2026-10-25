// The graft's reads and its slice, which the shell mounts: how the part of
// a surplus's work share that divides by pay would divide among the
// members, by what each was paid that year, until it is allocated. Its
// parts, by pay and in equal parts, are made by this graft's trigger in
// the write that allocates.
import type { Db, Slice } from '@cella/org-db'

export interface Part {
  id: string
  member: string
  basis: number
  amount: number
}

export async function parts(db: Db, allocation: string): Promise<Part[]> {
  const { rows } = await db.query<Part>(
    `SELECT w.member AS id, w.member, w.basis::float8 AS basis, w.amount::float8 AS amount
     FROM account_payslip.work_share w
     JOIN account.allocation a ON a.id = w.allocation AND a.allocated IS NULL
     WHERE w.allocation = $1 ORDER BY w.amount DESC, w.member`,
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
