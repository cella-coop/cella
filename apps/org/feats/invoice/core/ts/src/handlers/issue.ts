import type { Outcome } from '@cella/org-actions'
import { personal, write, type Deps, type Write } from '@cella/org-db'
import { priced } from '@cella/org-vat'
import type { actions } from '../models/actions.ts'
import type { Issue, Issued } from '../models/invoice.ts'

const op = 'invoice:invoice:issue' satisfies keyof typeof actions

// What the log keeps of an invoice issued beyond its number and amounts,
// so its fold issues it again (`invoice.fold_issue`): its series, due
// day, label, the seller as it was kept and its lines as written,
// `priced`, apart from the request's lines it was priced from, each
// quantity and VAT rate as their text, since a payload holds no float.
interface Kept {
  series: string
  due: string
  label: string
  seller: unknown
  priced: { n: number; description: string; quantity: string; unit_price: number; amount: number; vat_rate: string }[]
}

// Spends the series' next number (`invoice.spend`) and issues the invoice
// on the verdict date, its amounts computed in SQL from its lines by the
// VAT core library's `priced`, as a bill's are, each line's VAT rate sent
// in hundredths of a percent, and the seller kept as the coop's particulars
// name it then (`invoice.seller`). The guards on the op decide: `invoice.numbered`, that the number follows the
// last with no gap; `invoice.identified`, that the invoice names its buyer,
// their address and its seller's mentions; and any graft's on the op.
export const issuing = (input: Issue): Write<Issued> => {
  let kept: Kept | null = null
  return {
    op,
    request: input,
    state: async (tx) => {
      const { rows } = await tx.query<{ id: string; issued: string; net: string; vat: string | null; total: string; due: string; seller: unknown; priced: Kept['priced'] }>(
        `WITH spent AS (SELECT invoice.spend($1) AS number),
         lines AS (${priced('$5')}),
         sums AS (SELECT sum(amount)::bigint AS net, sum(vat)::bigint AS vat FROM lines),
         made AS (
           INSERT INTO invoice.invoice (id, series, number, issued, due, bill_to, bill_address, label, net, vat, total)
           SELECT invoice.number_id($1, spent.number), $1, spent.number, cella.verdict_date(),
                  coalesce($4::date, cella.verdict_date() + 30), $2, $6, $3,
                  cella.amount(sums.net), CASE WHEN sums.vat > 0 THEN cella.amount(sums.vat) END,
                  cella.amount(sums.net + sums.vat)
           FROM spent, sums
           RETURNING id, issued, due, seller, net, vat, total
         ),
         lined AS (
           INSERT INTO invoice.line (invoice, n, description, quantity, unit_price, amount, vat_rate)
           SELECT made.id, lines.n, lines.description, lines.quantity, cella.amount(lines.unit_price),
                  cella.amount(lines.amount), lines.vat_rate
           FROM made, lines
           RETURNING n, description, quantity, unit_price, amount, vat_rate
         )
         SELECT id, to_char(issued, 'YYYY-MM-DD') AS issued, to_char(due, 'YYYY-MM-DD') AS due, seller,
                cella.cents(net) AS net, cella.cents(vat) AS vat, cella.cents(total) AS total,
                (SELECT jsonb_agg(jsonb_build_object('n', l.n, 'description', l.description, 'quantity', l.quantity::text,
                   'unit_price', cella.cents(l.unit_price), 'amount', cella.cents(l.amount), 'vat_rate', l.vat_rate::text) ORDER BY l.n)
                 FROM lined l) AS priced
         FROM made`,
        [input.series, input.bill_to, input.label, input.due ?? null, JSON.stringify(input.lines), input.bill_address],
      )
      const r = rows[0]
      kept = { series: input.series, due: r.due, label: input.label, seller: r.seller, priced: r.priced }
      return {
        invoice: r.id,
        issued: r.issued,
        net: Number(r.net),
        vat: r.vat === null ? null : Number(r.vat),
        total: Number(r.total),
      }
    },
    // The number, the amounts and what the fold issues again; the name and
    // address billed may be a person's, so the log keeps their commitments
    // and the vault their values.
    payload: (v) => ({
      invoice: v.invoice,
      issued: v.issued,
      net: v.net,
      vat: v.vat,
      total: v.total,
      ...kept,
      bill_to: personal('invoice.invoice.bill_to', v.invoice, input.bill_to),
      bill_address: personal('invoice.invoice.bill_address', v.invoice, input.bill_address ?? null),
    }),
  }
}

// Bounded on the series: at rung 1 the server's right never runs out, so it
// settles at once unless the number would leave a gap or be reused.
export async function issue(input: Issue, deps: Deps): Promise<Outcome<(typeof actions)[typeof op], Issued>> {
  return write(deps, issuing(input))
}
