import type { Outcome } from '@cella/org-actions'
import { write, type Deps, type Write } from '@cella/org-db'
import { priced } from '@cella/org-vat'
import type { actions } from '../models/actions.ts'
import type { Issue, Issued } from '../models/invoice.ts'

const op = 'invoice:invoice:issue' satisfies keyof typeof actions

// Spends the series' next number (`invoice.spend`) and issues the invoice
// on the verdict date, its amounts computed in SQL from its lines by the
// VAT core library's `priced`, as a bill's are, each line's VAT rate sent
// in hundredths of a percent, and the seller kept as the scope's settings
// name it then (`invoice.seller`). The guards on the op decide: `invoice.numbered`, that the number follows the
// last with no gap, and any graft's on the op.
export const issuing = (input: Issue): Write<Issued> => ({
  op,
  request: input,
  state: async (tx) => {
    const { rows } = await tx.query<{ id: string; issued: string; net: string; vat: string | null; total: string }>(
      `WITH spent AS (SELECT invoice.spend($1) AS number),
       lines AS (${priced('$5')}),
       sums AS (SELECT sum(amount)::bigint AS net, sum(vat)::bigint AS vat FROM lines),
       made AS (
         INSERT INTO invoice.invoice (id, series, number, issued, due, bill_to, bill_address, label, net, vat, total)
         SELECT invoice.number_id($1, spent.number), $1, spent.number, cella.verdict_date(),
                coalesce($4::date, cella.verdict_date() + 30), $2, nullif(btrim($6), ''), $3,
                cella.amount(sums.net), CASE WHEN sums.vat > 0 THEN cella.amount(sums.vat) END,
                cella.amount(sums.net + sums.vat)
         FROM spent, sums
         RETURNING id, issued, net, vat, total
       ),
       lined AS (
         INSERT INTO invoice.line (invoice, n, description, quantity, unit_price, amount, vat_rate)
         SELECT made.id, lines.n, lines.description, lines.quantity, cella.amount(lines.unit_price),
                cella.amount(lines.amount), lines.vat_rate
         FROM made, lines
       )
       SELECT id, to_char(issued, 'YYYY-MM-DD') AS issued, cella.cents(net) AS net, cella.cents(vat) AS vat,
              cella.cents(total) AS total
       FROM made`,
      [input.series, input.bill_to, input.label, input.due ?? null, JSON.stringify(input.lines), input.bill_address ?? null],
    )
    const r = rows[0]
    return {
      invoice: r.id,
      issued: r.issued,
      net: Number(r.net),
      vat: r.vat === null ? null : Number(r.vat),
      total: Number(r.total),
    }
  },
  // Amounts and the number; the name and address billed may be a person's,
  // so they stay out.
  payload: (v) => ({ invoice: v.invoice, issued: v.issued, net: v.net, vat: v.vat, total: v.total }),
})

// Bounded on the series: at rung 1 the server's right never runs out, so it
// settles at once unless the number would leave a gap or be reused.
export async function issue(input: Issue, deps: Deps): Promise<Outcome<(typeof actions)[typeof op], Issued>> {
  return write(deps, issuing(input))
}
