import type { Write } from '@cella/org-db'
import type { actions } from '../models/actions.ts'
import type { Distribute, Distributed } from '../models/distribution.ts'

const op = 'patronage:distribution:distribute' satisfies keyof typeof actions

// Distributes an approved split on the verdict date, citing the motion
// that approved it. The feat alone cannot post it, so its only handler is
// the patronage-transaction graft's, which wraps this spec with the entry
// and runs it after the approval; `patronage.distributes` decides that it
// was approved, motion-patronage's that the motion approved it, and the
// graft that posts its lines.
export const distributing = (input: Distribute): Write<Distributed> => ({
  op,
  request: input,
  state: async (tx) => {
    const { rows } = await tx.query<{ distributed: string; year: number; surplus: string }>(
      `UPDATE patronage.distribution SET distributed = cella.verdict_date() WHERE id = $1
       RETURNING to_char(distributed, 'YYYY-MM-DD') AS distributed, year, cella.cents(surplus) AS surplus`,
      [input.distribution],
    )
    const d = rows[0]
    return { ...input, distributed: d?.distributed ?? '', year: d?.year ?? 0, surplus: Number(d?.surplus ?? 0) }
  },
  payload: (v) => ({ ...v }),
})
