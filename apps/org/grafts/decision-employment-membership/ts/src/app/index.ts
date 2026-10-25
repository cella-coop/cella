import type { App } from '@cella/org-ui'
import Admission from './blocks/Admission.svelte'

// The graft's client side: on a candidate's member page, under joining,
// where their admission stands, and the proposal filled in once their
// probation is over.
export const app: App = {
  name: 'decision-employment-membership',
  extends: {
    people: { page: { blocks: [{ tab: 'joining', block: Admission }] } },
  },
}
