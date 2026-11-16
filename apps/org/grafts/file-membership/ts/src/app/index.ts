import type { App } from '@cella/org-ui'
import Records from './blocks/Records.svelte'

// The graft's client side: a member's records on file, on their page's
// Work tab, with another filed.
export const app: App = {
  name: 'file-membership',
  extends: {
    people: {
      page: { blocks: [{ tab: 'work', block: Records }] },
    },
  },
}
