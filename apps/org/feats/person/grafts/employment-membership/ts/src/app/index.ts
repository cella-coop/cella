import { date, type App, type Event, type Tone } from '@cella/org-ui'
import type { Path, Stage } from '../models/path.ts'
import PathBlock from './blocks/Path.svelte'

const tones: Record<Stage, Tone> = { employee: 'neutral', candidate: 'accent', invited: 'accent', member: 'positive', gone: 'neutral' }

// The probation in a person's activity; their hire is employment's.
const events = (p: Path | null): Event[] => (p?.probation ? [{ at: p.probation, text: `candidate, on probation to ${date(p.probationEnd)}` }] : [])

// The graft's client side: each person's stage on their way to membership,
// a hidden column to filter by; on their page, the path they took and
// their probation in the activity. The application is
// circle-membership-motion's.
export const app: App = {
  name: 'employment-membership',
  extends: {
    people: {
      columns: [
        {
          key: 'stage',
          label: 'Path',
          kind: 'badge',
          role: 'hidden',
          value: (r: { stage?: Stage }) => r.stage ?? '',
          tone: (r: { stage?: Stage }) => tones[r.stage ?? 'employee'],
        },
      ],
      page: {
        blocks: [PathBlock],
        activity: events,
      },
    },
  },
}
