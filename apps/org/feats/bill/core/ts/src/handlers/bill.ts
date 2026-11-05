import type { Outcome } from '@cella/org-actions'
import { write, type Db, type Deps, type Write } from '@cella/org-db'
import { priced } from '@cella/org-vat'
import type { actions } from '../models/actions.ts'
import type { Act, Acted, Incoming, Recorded } from '../models/bill.ts'

type Action = keyof typeof actions
type Out<O extends Action, T> = Promise<Outcome<(typeof actions)[O], T>>

// What the log keeps of a bill recorded beyond its id and amounts, so its
// fold records it again (`bill.fold_record`): the supplier, its reference,
// the days it bears, its label and category, and its lines as written,
// `priced`, apart from the request's lines it was priced from, each
// quantity and VAT rate as their text, since a payload holds no float.
interface Kept {
  supplier: string
  reference: string
  issued: string
  due: string
  label: string
  category: string
  priced: { n: number; description: string; quantity: string; unit_price: number; amount: number; vat_rate: string }[]
}

// Records a supplier's bill and its lines in one statement, as the actor
// on the verdict date, its amounts computed in SQL from its lines by the
// VAT core library's `priced`, as an invoice's are, in the circle it
// names, or the root's. The same supplier's
// reference recorded again merges into the bill already recorded.
export const recording = (input: Incoming, actor: string): Write<Recorded> => {
  let kept: Kept | null = null
  return {
    op: 'bill:bill:record' satisfies Action,
    request: input,
    state: async (tx) => {
      const { rows } = await tx.query<{ id: string; circle: string; net: string; vat: string | null; total: string; issued: string; due: string; priced: Kept['priced'] }>(
        `WITH lines AS (${priced('$7')}),
         sums AS (SELECT sum(amount)::bigint AS net, sum(vat)::bigint AS vat FROM lines),
         made AS (
           INSERT INTO bill.bill (supplier, reference, issued, due, label, category, net, vat, total, recorded, recorder, circle)
           SELECT $1, $2, $3::date, coalesce($4::date, $3::date + 30), $5, $6,
                  cella.amount(sums.net), CASE WHEN sums.vat > 0 THEN cella.amount(sums.vat) END,
                  cella.amount(sums.net + sums.vat), cella.verdict_date(), $8, coalesce($9, circle.assembly())
           FROM sums
           ON CONFLICT (supplier, reference) DO NOTHING
           RETURNING id, circle, issued, due, net, vat, total
         ),
         lined AS (
           INSERT INTO bill.line (bill, circle, n, description, quantity, unit_price, amount, vat_rate)
           SELECT made.id, made.circle, lines.n, lines.description, lines.quantity, cella.amount(lines.unit_price),
                  cella.amount(lines.amount), lines.vat_rate
           FROM made, lines
           RETURNING n, description, quantity, unit_price, amount, vat_rate
         )
         SELECT id, circle, cella.cents(net) AS net, cella.cents(vat) AS vat, cella.cents(total) AS total,
                to_char(issued, 'YYYY-MM-DD') AS issued, to_char(due, 'YYYY-MM-DD') AS due,
                (SELECT jsonb_agg(jsonb_build_object('n', l.n, 'description', l.description, 'quantity', l.quantity::text,
                   'unit_price', cella.cents(l.unit_price), 'amount', cella.cents(l.amount), 'vat_rate', l.vat_rate::text) ORDER BY l.n)
                 FROM lined l) AS priced
         FROM made`,
        [input.supplier, input.reference, input.issued, input.due ?? null, input.label, input.category, JSON.stringify(input.lines), actor, input.circle ?? null],
      )
      const fresh = rows.length > 0
      const r = fresh
        ? rows[0]
        : (
            await tx.query<{ id: string; circle: string; net: string; vat: string | null; total: string }>(
              `SELECT id, circle, cella.cents(net) AS net, cella.cents(vat) AS vat, cella.cents(total) AS total
               FROM bill.bill WHERE supplier = $1 AND reference = $2`,
              [input.supplier, input.reference],
            )
          ).rows[0]
      kept = fresh
        ? { supplier: input.supplier, reference: input.reference, issued: rows[0].issued, due: rows[0].due, label: input.label, category: input.category, priced: rows[0].priced }
        : null
      return { bill: r.id, circle: r.circle, net: Number(r.net), vat: r.vat === null ? null : Number(r.vat), total: Number(r.total), merged: !fresh }
    },
    // The bill's id and amounts, and for a bill not merged what its fold
    // records again. The supplier and the label are the books' mentions
    // and the log keeps them as they are: no column of a bill says whose
    // its supplier is, so it is not registered personal (`003-personal.sql`).
    payload: (v) => ({ ...v, ...kept }),
  }
}

// Confluent: two records of one bill merge, and nothing waits.
export async function record(input: Incoming, deps: Deps): Out<'bill:bill:record', Recorded> {
  return write(deps, recording(input, deps.actor))
}

// Moves a bill to a status on the verdict date and returns its owning
// circle, its total and the day.
async function move(tx: Db, bill: string, set: string, actor?: string): Promise<Acted> {
  const { rows } = await tx.query<{ circle: string; total: string; day: string }>(
    `UPDATE bill.bill SET ${set} WHERE id = $1
     RETURNING circle, cella.cents(total) AS total, to_char(cella.verdict_date(), 'YYYY-MM-DD') AS day`,
    actor ? [bill, actor] : [bill],
  )
  return { bill, circle: rows[0]?.circle ?? '', amount: Number(rows[0]?.total ?? 0), day: rows[0]?.day ?? '' }
}

// Approves a recorded bill as the actor. The bill-transaction graft wraps
// it with the entry charging it; `bill.approves` refuses its recorder.
export const approving = (input: Act, actor: string): Write<Acted> => ({
  op: 'bill:bill:approve' satisfies Action,
  request: input,
  state: (tx) => move(tx, input.bill, `status = 'approved', approved = cella.verdict_date(), approver = $2`, actor),
  payload: (v) => ({ ...v }),
})

export async function approve(input: Act, deps: Deps): Out<'bill:bill:approve', Acted> {
  return write(deps, approving(input, deps.actor))
}

// Pays an approved bill. The bill-transaction graft wraps it with the
// payment from the bank.
export const paying = (input: Act): Write<Acted> => ({
  op: 'bill:bill:pay' satisfies Action,
  request: input,
  state: (tx) => move(tx, input.bill, `status = 'paid', paid = cella.verdict_date()`),
  payload: (v) => ({ ...v }),
})

export async function pay(input: Act, deps: Deps): Out<'bill:bill:pay', Acted> {
  return write(deps, paying(input))
}
