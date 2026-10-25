import { icons, type App, type Tone } from '@cella/org-ui'
import type { Contract, Worker } from '../models/worker.ts'
import Hire from './blocks/Hire.svelte'

const contracts: Record<Contract, string> = { permanent: 'Permanent', 'fixed-term': 'Fixed-term', apprenticeship: 'Apprenticeship' }
const tone = (w: Worker): Tone => (w.employed ? 'positive' : 'neutral')
const standing = (w: Worker) => (w.employed ? 'employed' : 'left')

// The feat's client side: every worker, member or not, with their job and
// contract, hiring one, and a worker's page.
export const app: App = {
  name: 'worker',
  collections: {
    workers: {
      view: {
        group: 'work',
        title: 'Workers',
        caption: 'Everyone the co-op employs, member or not, and their contracts',
        icon: icons.IdentificationBadge,
        create: Hire,
        columns: [
          { key: 'name', label: 'Name', kind: 'title', role: 'title', value: (w: Worker) => w.name },
          { key: 'job', label: 'Job', role: 'sub', value: (w: Worker) => w.job },
          { key: 'contract', label: 'Contract', kind: 'badge', role: 'hidden', value: (w: Worker) => contracts[w.contract] },
          { key: 'start', label: 'Since', kind: 'date', role: 'hidden', value: (w: Worker) => w.start },
          { key: 'until', label: 'Until', kind: 'date', role: 'hidden', value: (w: Worker) => w.until },
          { key: 'hours', label: 'Hours a week', kind: 'number', role: 'hidden', value: (w: Worker) => w.hours },
          { key: 'employed', label: 'Employed', kind: 'badge', role: 'meta', value: standing, tone },
        ],
        look: { layout: 'table' },
      },
      page: {
        eyebrow: 'Worker',
        title: (w: Worker) => w.name,
        subtitle: (w: Worker) => w.job,
        properties: (w: Worker) => [
          { label: 'Employed', value: standing(w), kind: 'badge', tone: tone(w) },
          { label: 'Contract', value: contracts[w.contract] },
          { label: 'Since', value: w.start, kind: 'date' },
          ...(w.until ? [{ label: 'Until', value: w.until, kind: 'date' as const }] : []),
          { label: 'Hours a week', value: w.hours, kind: 'number' },
          { label: 'Address', value: w.address, kind: 'mono' },
        ],
        activity: (w: Worker) => [
          ...(w.until ? [{ at: w.until, text: w.employed ? 'contract ends' : 'left' }] : []),
          { at: w.start, text: 'started' },
          ...(w.hired !== w.start ? [{ at: w.hired, text: 'hire recorded' }] : []),
        ],
      },
    },
  },
}
