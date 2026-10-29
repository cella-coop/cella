import { cents, hundredths, type Form } from '@cella/org-db'

// A line as a write's request holds it.
export interface Line {
  description: string
  // A decimal, as text, so that 2.5 days stays exact.
  quantity: string
  // Cents.
  unit_price: number
  // A percentage in hundredths, so that a signed request holds an
  // integer: 2000 for France's standard rate, 550 for 5,5 %.
  vat_rate: number
}

// The net of a document's lines at one VAT rate and the tax on it, in
// cents.
export interface Taxed {
  rate: string
  base: number
  tax: number
}

// The lines a form types, each field repeated once per line, in order:
// amounts in euros, VAT rates in percent, `rate` where one is left empty.
// A line without a description is dropped; no line at all is refused.
export function lines(form: Form, rate = '20'): Line[] {
  const quantities = form.all('quantity')
  const prices = form.all('unit_price')
  const rates = form.all('vat_rate')
  const typed = form
    .all('description')
    .map((description, i) => ({
      description,
      quantity: quantities[i] || '1',
      unit_price: cents(prices[i] ?? '', false),
      vat_rate: hundredths(rates[i] || rate),
    }))
    .filter((l) => l.description.trim())
  if (!typed.length) {
    throw new Error('at least one line is needed')
  }
  return typed
}

// The lines a request holds, passed as JSON in the parameter named
// (`$5`), read into rows numbered from 1: each with its description,
// quantity, unit price and rate in percent, and its `amount` and `vat` in
// cents, by `cella.line_amount` and `cella.line_vat`. A handler inserts
// its lines and sums its document from it, in its own write.
export const priced = (param: string) => `
  SELECT p.n, p.description, p.quantity, p.unit_price, p.vat_rate, p.amount, cella.line_vat(p.amount, p.vat_rate) AS vat
  FROM (
    SELECT x.n::integer AS n, x.description, x.quantity, x.unit_price, x.vat_rate / 100.0 AS vat_rate,
           cella.line_amount(x.quantity, x.unit_price) AS amount
    FROM ROWS FROM (jsonb_to_recordset(${param}::jsonb)
           AS (description text, quantity numeric, unit_price bigint, vat_rate bigint))
      WITH ORDINALITY AS x (description, quantity, unit_price, vat_rate, n)
  ) p`
