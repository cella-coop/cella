import type { Db } from '@cella/org-db'
import type { Entry, Posted } from '../models/transaction.ts'

// Writes an entry and its lines inside a write's transaction, numbered from
// the journal's sequence and ordered by a receipt. Whether it balances is the
// feat's deferred trigger's; whether its accounts and period take it, the
// account-transaction graft's. The writes that post, this feat's own and the
// grafts', share it.
export async function record(tx: Db, entry: Entry, corrects?: string): Promise<Posted> {
  const { rows } = await tx.query<{ id: string; receipt: string }>(
    `INSERT INTO transaction.entry (date, label, corrects, receipt)
     VALUES ($1, $2, $3, cella.receipt())
     RETURNING id, receipt`,
    [entry.date, entry.label, corrects ?? null],
  )
  const { id, receipt } = rows[0]
  await tx.query(
    `INSERT INTO transaction.line (entry, n, account, side, amount)
     SELECT $1, x.n, x.account, x.side, cella.amount(x.cents)
     FROM ROWS FROM (jsonb_to_recordset($2::jsonb) AS (account text, side text, cents bigint))
       WITH ORDINALITY AS x (account, side, cents, n)`,
    [id, JSON.stringify(entry.lines)],
  )
  return { entry: id, receipt: Number(receipt) }
}

// What the log keeps of an entry so its fold posts it again
// (`transaction.fold_record`): its date, its label and its lines, as the
// journal shows them. A write that posts, this feat's or a graft's,
// carries it in its payload.
export const logged = (entry: Entry) => ({
  date: entry.date,
  label: entry.label,
  lines: entry.lines.map((l) => ({ ...l })),
})

// What the log commits to for an entry this feat posts: the entry as
// `logged` keeps it, and `amount`, the sum of its debits, which is what a
// mandate's limit caps.
export const committed = (posted: Posted, entry: Entry) => ({
  entry: posted.entry,
  amount: entry.lines.filter((l) => l.side === 'debit').reduce((sum, l) => sum + l.cents, 0),
  ...logged(entry),
})
