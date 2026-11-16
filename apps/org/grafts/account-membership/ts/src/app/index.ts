import type { App } from '@cella/org-ui'
import type { Rights } from '../models/capital.ts'
import Capital from './blocks/Capital.svelte'
import Owns from './blocks/Owns.svelte'
import Subscribe from './blocks/Subscribe.svelte'

// The graft's client side: each member's subscribed capital in the
// members list and on their page, the capital joining asks and what a
// member owns, read back from the statutes' capital clauses; and who
// holds each capital account in the chart.
export const app: App = {
  name: 'account-membership',
  extends: {
    people: {
      columns: [{ key: 'capital', label: 'Capital', kind: 'money', role: 'hidden', value: (r: { capital?: number }) => r.capital ?? 0 }],
      page: {
        properties: (c: Rights | null) => (c?.allowance ? [{ label: 'Draw limit', value: c.allowance, kind: 'money' }] : []),
        blocks: [{ tab: 'membership', block: Capital }, { tab: 'membership', block: Subscribe }, { tab: 'membership', block: Owns }],
      },
    },
    accounts: {
      columns: [{ key: 'holder', label: 'Holder', role: 'hidden', value: (r: { holder?: string }) => r.holder ?? '' }],
    },
  },
}
