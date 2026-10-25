import { cents, type Form } from '@cella/org-db'
import type { Issue, Payment, Send, Void } from '../models/invoice.ts'

// What the shell's forms send, read into the handlers' inputs. Amounts are
// typed in euros and sent in cents; a line repeats its fields once per
// line, in order.

export function issue(form: Form): Issue {
  const descriptions = form.all('description')
  const quantities = form.all('quantity')
  const prices = form.all('unit_price')
  const rates = form.all('vat_rate')
  const lines = descriptions
    .map((description, i) => ({ description, quantity: quantities[i] ?? '1', unit_price: cents(prices[i] ?? '', false), vat_rate: Number(rates[i] ?? 20) }))
    .filter((l) => l.description.trim())
  if (!lines.length) {
    throw new Error('an invoice needs at least one line')
  }
  return { series: form.get('series'), bill_to: form.get('bill_to'), bill_address: form.get('bill_address').replace(/\r\n?/g, '\n') || undefined, label: form.get('label'), due: form.get('due') || undefined, lines }
}

export const payment = (form: Form, invoice: string): Payment => ({
  invoice,
  at: form.get('at'),
  amount: cents(form.get('amount'), false),
  method: form.get('method') || undefined,
  reference: form.get('reference'),
})

export const voiding = (form: Form, invoice: string): Void => ({ invoice, reason: form.get('reason') })

export const sending = (invoice: string): Send => ({ invoice })
