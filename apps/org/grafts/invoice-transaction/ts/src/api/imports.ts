import { csv, hundredths, type Imported, type Importer } from '@cella/org-db'
import type { Line } from '@cella/org-vat'
import { issue } from '../handlers/post.ts'

// A day as YYYY-MM-DD, from that or DD/MM/YYYY.
const day = (typed: string) => {
  const fr = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(typed.trim())
  return fr ? `${fr[3]}-${fr[2]}-${fr[1]}` : typed.trim()
}

// Euros typed with a comma or a point, in cents.
const cents = (typed: string) => Math.round(Number(typed.replace(/\s/g, '').replace(',', '.')) * 100)

// A VAT rate typed in percent, in hundredths; NaN where it is not one.
const percent = (typed: string) => {
  try {
    return hundredths(typed)
  } catch {
    return NaN
  }
}

// Invoices to issue from a spreadsheet or another tool's drafts, a CSV
// with a row for each line and the columns `client`, `address`, the
// address billed, `description`, `quantity`, `unit_price` in euros and
// `vat_rate` in percent (`5,5` or `20`), and if it has them `invoice`,
// rows sharing it making one invoice, `label` and `due`. An invoice
// without its address is refused at issue (`invoice.identified`).
// Each invoice is issued now, as the importing member, numbered in the
// coop's series and posted, as one issued by hand is. Invoices issued
// before cella are in the old books, and come in through the FEC as their
// entries, so nothing is posted twice. A line is labelled by its row's
// invoice reference.
export const invoices: Importer = {
  title: 'Invoices to issue',
  formats: 'CSV with a row for each line: client, address, description, quantity, unit_price, vat_rate, and invoice, label and due if it has them',
  read: async (text, db) => {
    const { rows: series } = await db.query<{ name: string }>('SELECT name FROM invoice.series ORDER BY name LIMIT 1')
    const groups = new Map<string, { line: number; bill_to: string; bill_address: string; label: string; due?: string; lines: Line[]; unread: string | null }>()
    for (const { line, fields } of csv(text)) {
      const key = fields.invoice || `line ${line}`
      const g = groups.get(key) ?? { line, bill_to: fields.client ?? '', bill_address: fields.address ?? '', label: fields.label || fields.description || '', due: fields.due ? day(fields.due) : undefined, lines: [], unread: null }
      const price = cents(fields.unit_price ?? '')
      const rate = percent(fields.vat_rate ?? '20')
      if (!fields.description || !fields.quantity || !Number.isFinite(price) || price <= 0 || !Number.isFinite(rate)) {
        g.unread ??= `its line ${line} needs a description, a quantity, a unit price and a VAT rate`
      } else {
        g.lines.push({ description: fields.description, quantity: fields.quantity.replace(',', '.'), unit_price: price, vat_rate: rate })
      }
      groups.set(key, g)
    }
    return [...groups].map(([key, g]): Imported => {
      if (!series[0]) {
        return { line: g.line, label: key, op: 'invoice:invoice:issue', refused: 'the coop has no invoice series to number it in' }
      }
      if (g.unread || !g.bill_to) {
        return { line: g.line, label: key, op: 'invoice:invoice:issue', refused: g.unread ?? 'an invoice bills a client' }
      }
      const input = { series: series[0].name, bill_to: g.bill_to, bill_address: g.bill_address, label: g.label, due: g.due, lines: g.lines }
      return { line: g.line, label: key, op: 'invoice:invoice:issue', run: (deps) => issue(input, deps) }
    })
  },
}
