// The feat's public writes, POST /api/employment/<op> once the server exists,
// the write a graft may extend in its transaction, its reads, and its
// slice, which the shell mounts.
import { action, type Form, type Slice } from '@cella/org-db'
import { hire } from '../handlers/index.ts'
import { today, worker, workers } from '../drivers/worker.ts'
import type { Contract, Hire } from '../models/worker.ts'

export { hire, hiring } from '../handlers/index.ts'
export { today, worker, workers } from '../drivers/worker.ts'

// Hours a week, typed as a decimal, a comma or a point, sent in whole
// minutes.
export function weekly(typed: string): number {
  const n = Number(typed.trim().replace(',', '.'))
  if (!typed.trim() || !Number.isFinite(n) || n <= 0 || n > 48) {
    throw new Error(`“${typed}” is not a number of hours a week`)
  }
  return Math.round(n * 60)
}

// What the hire form sends, read into the write's input.
export const hired = (form: Form): Hire => ({
  worker: form.get('address').trim(),
  name: form.get('name').trim(),
  job: form.get('job').trim(),
  contract: form.get('contract') as Contract,
  start: form.get('start'),
  until: form.get('until') || undefined,
  minutes: weekly(form.get('hours')),
  key: form.get('key'),
  label: form.get('label').trim(),
})

// The feat's server side, on its parent's people: on each person the
// employment they hold, member or not, and hiring one, with their first
// device, as the people collection's New form.
export const slice: Slice = {
  name: 'employment',
  within: 'person',
  extends: {
    people: {
      list: async (db) =>
        Object.fromEntries((await workers(db)).map(({ id, job, contract, start, until, hours, employed }) => [id, { job, contract, start, until, hours, employed }])),
      about: today,
      item: async (db, address) => ({ worker: await worker(db, address) }),
      actions: {
        hire: action('employment:worker:hire', (form) => hired(form), hire),
      },
    },
  },
}
