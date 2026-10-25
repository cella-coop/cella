// The graft's reads and its slice, which the shell mounts: how the part of
// a surplus's work share that divides by pay would divide among the
// members, by what each was paid that year, until it is approved. Its
// parts, by pay and in equal parts, are made by this graft's trigger in
// the write that approves.
import type { Db, Slice } from '@cella/org-db'

export interface Part {
  id: string
  member: string
  basis: number
  amount: number
}

export async function parts(db: Db, distribution: string): Promise<Part[]> {
  const { rows } = await db.query<Part>(
    `SELECT w.member AS id, w.member, w.basis::float8 AS basis, w.amount::float8 AS amount
     FROM patronage_payslip.work_share w
     JOIN patronage.distribution x ON x.id = w.distribution AND x.approved IS NULL
     WHERE w.distribution = $1 ORDER BY w.amount DESC, w.member`,
    [distribution],
  )
  return rows
}

export const slice: Slice = {
  name: 'patronage-payslip',
  extends: {
    distributions: { item: parts },
  },
}
