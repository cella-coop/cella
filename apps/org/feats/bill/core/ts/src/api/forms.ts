import type { Form } from '@cella/org-db'
import { lines } from '@cella/org-vat'
import { categories, type Act, type Incoming } from '../models/bill.ts'

// What the shell's forms send, read into the handlers' inputs. A bill's
// lines are typed as an invoice's are, amounts in euros and VAT rates in
// percent, and read by the VAT core library.

export function record(form: Form): Incoming {
  const category = form.get('category')
  if (!categories.some((c) => c.code === category)) {
    throw new Error(`“${category}” is no category of bill`)
  }
  return {
    supplier: form.get('supplier').trim(),
    reference: form.get('reference').trim(),
    issued: form.get('issued'),
    due: form.get('due') || undefined,
    label: form.get('label'),
    category,
    lines: lines(form),
  }
}

export const act = (bill: string): Act => ({ bill })
