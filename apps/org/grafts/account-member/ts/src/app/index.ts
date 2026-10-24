import type { App } from '@cella/org-ui'
import type { Capital as Held } from '../models/capital.ts'
import Capital from './blocks/Capital.svelte'

// The graft's client side: each member's subscribed capital in the
// members list and on their page, and who holds each capital account in
// the chart.
export const app: App = {
  name: 'account-member',
  extends: {
    members: {
      columns: [{ key: 'capital', label: 'Capital', kind: 'money', role: 'hidden', value: (r: { capital?: number }) => r.capital ?? 0 }],
      page: {
        properties: (c: Held | null) => (c?.allowance ? [{ label: 'Draw limit', value: c.allowance, kind: 'money' }] : []),
        blocks: [Capital],
      },
    },
    accounts: {
      columns: [{ key: 'holder', label: 'Holder', role: 'hidden', value: (r: { holder?: string }) => r.holder ?? '' }],
    },
  },
}
