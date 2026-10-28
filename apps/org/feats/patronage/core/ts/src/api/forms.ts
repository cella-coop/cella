import { cents, hundredths, type Form } from '@cella/org-db'
import type { Draft } from '../models/distribution.ts'
import type { DraftTerms } from '../models/terms.ts'

// What the shell's drafting forms send, read into the handlers' inputs: a
// year, euros in cents, and percents in hundredths; a percent left empty
// is none.

const year = (typed: string) => {
  const n = Number(typed.trim())
  if (!Number.isInteger(n) || n < 1900 || n > 9999) {
    throw new Error(`“${typed}” is not a year`)
  }
  return n
}

const percent = (typed: string) => (typed.trim() ? hundredths(typed) : 0)

export const draft = (form: Form): Draft => ({
  year: year(form.get('year')),
  surplus: cents(form.get('surplus')),
  work: percent(form.get('work')),
  legal: percent(form.get('legal')),
  development: percent(form.get('development')),
  interest: percent(form.get('interest')),
})

export const terms = (form: Form): DraftTerms => ({
  from: year(form.get('from')),
  salary: percent(form.get('salary')),
  hours: percent(form.get('hours')),
  equal: percent(form.get('equal')),
  capital: percent(form.get('capital')),
  interest: percent(form.get('interest')),
})
