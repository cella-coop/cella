import type { App } from '@cella/org-ui'
import Texts from './blocks/Texts.svelte'

// The graft's client side: on a member's page, under joining, the texts
// the coop adopted and whether they read each.
export const app: App = {
  name: 'document-membership',
  extends: {
    people: {
      page: { blocks: [{ tab: 'membership', block: Texts }] },
    },
  },
}
