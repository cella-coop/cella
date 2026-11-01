import type { Refused, Settled } from '@cella/org-actions'
import { write, type Deps } from '@cella/org-db'
import { adding } from '@cella/org-meeting/api'
import type { Put, Table } from '../models/tabled.ts'

// Tables a motion: an item added to the agenda, the meeting feat's,
// titled as the motion unless it is given a title of its own, and the
// motion it tables, in one transaction under one verdict, the feat's
// op. The feat's trigger and the seat guard on the op judge the item; the
// graft's trigger, that the motion exists.
export async function table(input: Table, deps: Deps): Promise<Settled<Put> | Refused> {
  const { motion, ...item } = input
  const w = adding(item)
  return write(deps, {
    op: w.op,
    request: input,
    state: async (tx, proof) => {
      const { rows } = await tx.query<{ title: string }>('SELECT title FROM motion.motion WHERE id = $1', [motion])
      const added = await adding({ ...item, title: item.title || (rows[0]?.title ?? motion) }).state(tx, proof)
      await tx.query('INSERT INTO meeting_motion.tabled (item, meeting, motion) VALUES ($1, $2, $3)', [added.item, added.meeting, motion])
      return { ...added, motion }
    },
    payload: (v) => ({ ...w.payload(v), motion: v.motion }),
  })
}
