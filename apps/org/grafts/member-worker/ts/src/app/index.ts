import { date, type App, type Event, type Tone } from '@cella/org-ui'
import type { Path, Stage } from '../models/path.ts'
import Candidacy from './blocks/Candidacy.svelte'
import PathBlock from './blocks/Path.svelte'

const tones: Record<Stage, Tone> = { employee: 'neutral', candidate: 'accent', invited: 'accent', member: 'positive', gone: 'neutral' }

const events = (p: Path | null): Event[] =>
  !p
    ? []
    : [
        ...(p.probation ? [{ at: p.probation, text: `candidate, on probation to ${date(p.probationEnd)}` }] : []),
        ...(p.hired ? [{ at: p.hired, text: 'hired' }] : []),
      ]

// The graft's client side: each worker's stage on their way to membership;
// on a worker's page and a member's, the path they took; and opening an
// employee's candidacy from their page.
export const app: App = {
  name: 'member-worker',
  extends: {
    workers: {
      columns: [
        {
          key: 'stage',
          label: 'Membership',
          kind: 'badge',
          role: 'meta',
          value: (r: { stage?: Stage }) => r.stage ?? '',
          tone: (r: { stage?: Stage }) => tones[r.stage ?? 'employee'],
        },
      ],
      page: {
        properties: (p: Path | null) => (p ? [{ label: 'Membership', value: p.stage, kind: 'badge', tone: tones[p.stage] }] : []),
        blocks: [PathBlock],
        actions: Candidacy,
      },
    },
    members: {
      page: {
        properties: (p: Path | null) => (p?.hired ? [{ label: 'Hired', value: p.hired, kind: 'date' }] : []),
        blocks: [PathBlock],
        activity: events,
      },
    },
  },
}
