import type { Refused, Settled } from '@cella/org-actions'
import { write, type Deps } from '@cella/org-db'
import { adding } from '@cella/org-meeting/api'
import type { Put, Table } from '../models/tabled.ts'

// Tables a decision: an item added to the agenda, the meeting feat's,
// titled as the decision unless it is given a title of its own, and the
// decision it tables, in one transaction under one verdict, the feat's
// op. The feat's trigger and the seat guard on the op judge the item; the
// graft's trigger, that the decision exists.
export async function table(input: Table, deps: Deps): Promise<Settled<Put> | Refused> {
  const { decision, ...item } = input
  const w = adding(item)
  return write(deps, {
    op: w.op,
    request: input,
    state: async (tx, proof) => {
      const { rows } = await tx.query<{ title: string }>('SELECT title FROM decision.decision WHERE id = $1', [decision])
      const added = await adding({ ...item, title: item.title || (rows[0]?.title ?? decision) }).state(tx, proof)
      await tx.query('INSERT INTO decision_meeting.tabled (item, meeting, decision) VALUES ($1, $2, $3)', [added.item, added.meeting, decision])
      return { ...added, decision }
    },
    payload: (v) => ({ ...w.payload(v), decision: v.decision }),
  })
}
