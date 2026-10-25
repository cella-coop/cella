import type { App } from '@cella/org-ui'
import Texts from './blocks/Texts.svelte'

// The graft's client side: on a member's page, under joining, the texts
// the co-op adopted and whether they read each.
export const app: App = {
  name: 'document-member',
  extends: {
    members: {
      page: { blocks: [{ tab: 'joining', block: Texts }] },
    },
  },
}
