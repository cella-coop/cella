import type { Form } from '@cella/org-db'
import { categories, type Capture } from '../models/expense.ts'

// What the shell's forms send, read into the handlers' inputs. Amounts are
// typed in euros, a comma or a point, and sent in whole cents; an expense
// is always the acting member's own.

export function cents(typed: string): number {
  const n = Number(typed.trim().replace(',', '.'))
  if (!typed.trim() || !Number.isFinite(n) || n <= 0) {
    throw new Error(`“${typed}” is not an amount in euros`)
  }
  return Math.round(n * 100)
}

export function capture(form: Form, member: string): Capture {
  const category = form.get('category')
  if (!categories.some((c) => c.code === category)) {
    throw new Error(`“${category}” is no category of expense`)
  }
  const vat = form.get('vat').trim()
  return {
    member,
    day: form.get('day'),
    label: form.get('label'),
    category,
    net: cents(form.get('net')),
    vat: vat && Number(vat.replace(',', '.')) !== 0 ? cents(vat) : null,
    receipt: form.get('receipt').trim() || null,
  }
}
