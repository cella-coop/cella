import type { App } from '@cella/org-ui'
import type { Held } from '../models/capital.ts'
import Capital from './blocks/Capital.svelte'
import Owns from './blocks/Owns.svelte'
import Statements from './blocks/Statements.svelte'
import Subscribe from './blocks/Subscribe.svelte'

// The graft's client side: each member's subscribed capital in the
// members list and on their page, their own work share statements there
// for themselves, the capital joining asks and what a member owns, read
// back from the statutes' terms; who holds each capital account in the
// chart, and whose a statement is.
export const app: App = {
  name: 'account-member',
  extends: {
    members: {
      columns: [{ key: 'capital', label: 'Capital', kind: 'money', role: 'hidden', value: (r: { capital?: number }) => r.capital ?? 0 }],
      page: {
        properties: (c: Held | null) => (c?.allowance ? [{ label: 'Draw limit', value: c.allowance, kind: 'money' }] : []),
        blocks: [Capital, Statements, { tab: 'joining', block: Subscribe }, { tab: 'rights', block: Owns }],
      },
    },
    accounts: {
      columns: [{ key: 'holder', label: 'Holder', role: 'hidden', value: (r: { holder?: string }) => r.holder ?? '' }],
    },
    statements: {
      page: {
        properties: (m: { member: string; name: string } | null) => (m ? [{ label: 'Member', value: m.name, href: `/members/${m.member}` }] : []),
      },
    },
  },
}
