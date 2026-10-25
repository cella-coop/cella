import type { App } from '@cella/org-ui'
import Records from './blocks/Records.svelte'

// The graft's client side: a member's records on file, in a tab of their
// page, with another filed.
export const app: App = {
  name: 'file-member',
  extends: {
    members: {
      page: { tabs: [{ id: 'records', label: 'Records' }], blocks: [{ tab: 'records', block: Records }] },
    },
  },
}
