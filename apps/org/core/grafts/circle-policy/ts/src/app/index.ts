import type { App } from '@cella/org-ui'
import type { Worded } from '../models/index.ts'

// The graft's client side: a mandate's page reads as its policy's
// sentence, and names the motion that adopted it.
export const app: App = {
  name: 'circle-policy',
  extends: {
    mandates: {
      page: {
        subtitle: (w: Worded | null) => w?.sentence ?? '',
        properties: (w: Worded | null) =>
          w?.motion ? [{ label: 'Adopted by', value: w.motion, kind: 'mono' as const, href: `/motions/${w.motion}` }] : [],
      },
    },
  },
}
