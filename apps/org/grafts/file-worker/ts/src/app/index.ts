import type { App } from '@cella/org-ui'
import Records from './blocks/Records.svelte'

// The graft's client side: a worker's employment records on their page,
// with another filed.
export const app: App = {
  name: 'file-worker',
  extends: {
    workers: {
      page: { blocks: [Records] },
    },
  },
}
