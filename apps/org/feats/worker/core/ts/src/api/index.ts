// The feat's public writes, POST /api/worker/<op> once the server exists,
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
})

// The workers, member or not, and hiring one, which key-worker replaces
// with a hire carrying the worker's first device.
export const slice: Slice = {
  name: 'worker',
  collections: {
    workers: {
      list: workers,
      about: today,
      item: worker,
      index: async (db) => (await workers(db)).map((w) => ({ id: w.id, title: w.name, sub: w.job })),
      actions: {
        hire: action('worker:worker:hire', (form) => hired(form), hire),
      },
    },
  },
}
