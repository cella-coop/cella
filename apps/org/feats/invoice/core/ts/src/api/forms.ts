import { cents, type Form } from '@cella/org-db'
import { lines } from '@cella/org-vat'
import type { Issue, Payment, Send, Void } from '../models/invoice.ts'

// What the shell's forms send, read into the handlers' inputs. Amounts are
// typed in euros and sent in cents, VAT rates typed in percent and sent in
// hundredths; a line repeats its fields once per line, in order, read by
// the VAT core library as a bill's are.

export const issue = (form: Form): Issue => ({
  series: form.get('series'),
  bill_to: form.get('bill_to'),
  bill_address: form.get('bill_address').replace(/\r\n?/g, '\n'),
  label: form.get('label'),
  due: form.get('due') || undefined,
  lines: lines(form),
})

export const payment = (form: Form, invoice: string): Payment => ({
  invoice,
  at: form.get('at'),
  amount: cents(form.get('amount'), false),
  method: form.get('method') || undefined,
  reference: form.get('reference'),
})

export const voiding = (form: Form, invoice: string): Void => ({ invoice, reason: form.get('reason') })

export const sending = (invoice: string): Send => ({ invoice })
