import type { Write } from '@cella/org-db'
import type { ops } from '../models/ops.ts'
import type { Allocate, Allocated } from '../models/allocation.ts'

const op = 'account:surplus:allocate' satisfies keyof typeof ops

// Allocates a year's surplus on the verdict date, citing the assembly's
// decision. The feat alone cannot post it, so its only handler is the
// account-transaction graft's, which wraps this spec with the entry; the
// rules decide: `account.splits` the split and the law's floors, the
// account-decision graft's that the decision approves this split, and
// circle-decision-member's that it passed.
export const allocating = (input: Allocate): Write<Allocated> => ({
  op,
  request: input,
  state: async (tx) => {
    const { rows } = await tx.query<{ allocated: string; year: number; surplus: string }>(
      `UPDATE account.allocation SET allocated = cella.verdict_date() WHERE id = $1
       RETURNING to_char(allocated, 'YYYY-MM-DD') AS allocated, year, cella.cents(surplus) AS surplus`,
      [input.allocation],
    )
    const a = rows[0]
    return { ...input, allocated: a?.allocated ?? '', year: a?.year ?? 0, surplus: Number(a?.surplus ?? 0) }
  },
  payload: (v) => ({ ...v }),
})
