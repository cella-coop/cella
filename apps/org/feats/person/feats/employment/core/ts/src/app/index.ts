import type { App, Tone } from '@cella/org-ui'
import { terms, type Employment, type Worker } from '../models/worker.ts'
import Hire from './blocks/Hire.svelte'

const tone = (w: Worker): Tone => (w.employed ? 'positive' : 'neutral')
const standing = (w: Worker) => (w.employed ? 'worker' : 'former worker')

// A person's row as the employment adds to it, where they hold one: their
// standing and their contract as their chips show them.
type Row = Partial<Pick<Worker, 'job' | 'start' | 'until' | 'hours' | 'employed'> & { worker: string; contract: string }>

// The feat's client side, on its parent's people: each person's
// employment, member or not, a chip to filter and group by, with their
// job and contract; the people collection's New form, a hire with the
// worker's first device; and on a person's page their contract, and the
// Employment tab the grafts joining employment fill.
export const app: App = {
  name: 'employment',
  extends: {
    people: {
      columns: [
        {
          key: 'worker',
          label: 'Worker',
          kind: 'badge',
          role: 'meta',
          value: (r: Row) => r.worker ?? '',
          tone: (r: Row) => (r.employed ? 'positive' : 'neutral'),
        },
        { key: 'job', label: 'Job', role: 'hidden', value: (r: Row) => r.job },
        { key: 'contract', label: 'Contract', kind: 'badge', role: 'hidden', value: (r: Row) => r.contract ?? '' },
        { key: 'start', label: 'Employed since', kind: 'date', role: 'hidden', value: (r: Row) => r.start },
      ],
      create: Hire,
      title: 'Hire',
      page: {
        properties: ({ worker: w }: Employment) =>
          w
            ? [
                { label: 'Worker', value: standing(w), kind: 'badge', tone: tone(w) },
                { label: 'Job', value: w.job },
                { label: 'Contract', value: terms[w.contract] },
                { label: 'Employed since', value: w.start, kind: 'date' },
                ...(w.until ? [{ label: 'Until', value: w.until, kind: 'date' as const }] : []),
                { label: 'Hours a week', value: w.hours, kind: 'number' },
              ]
            : [],
        activity: ({ worker: w }: Employment) =>
          w
            ? [
                ...(w.until ? [{ at: w.until, text: w.employed ? 'contract ends' : 'left' }] : []),
                { at: w.start, text: 'started' },
                ...(w.hired !== w.start ? [{ at: w.hired, text: 'hire recorded' }] : []),
              ]
            : [],
        tabs: [{ id: 'employment', label: 'Employment' }],
      },
    },
  },
}
