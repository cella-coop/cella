import type { App } from '@cella/org-ui'
import Devices from './blocks/Devices.svelte'
import Hire from './blocks/Hire.svelte'

// The graft's client side: the New form of the workers collection, a hire
// with its first device; and on a worker's page their devices.
export const app: App = {
  name: 'key-worker',
  extends: {
    workers: {
      create: Hire,
      page: { blocks: [Devices] },
    },
  },
}
