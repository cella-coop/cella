import type { Form } from '@cella/org-db'
import type { Add, Budget, Complete, Create } from '../models/project.ts'

// What the shell's forms send, read into the handlers' inputs. Amounts are
// typed in euros and sent in cents.

export function cents(typed: string): number {
  const n = Number(typed.replace(/\s/g, '').replace(',', '.'))
  if (!typed.trim() || !Number.isFinite(n) || n <= 0) {
    throw new Error(`“${typed}” is not an amount in euros`)
  }
  return Math.round(n * 100)
}

export const create = (form: Form): Create => ({
  title: form.get('title'),
  circle: form.get('circle') || undefined,
  summary: form.get('summary') || undefined,
  due: form.get('due') || undefined,
})

export const add = (form: Form, project: string): Add => ({ project, title: form.get('title'), due: form.get('due') || undefined })

export const complete = (form: Form, project: string): Complete => ({ project, n: Number(form.get('n')) })

export const budget = (form: Form, project: string): Budget => ({ project, amount: cents(form.get('amount')) })
