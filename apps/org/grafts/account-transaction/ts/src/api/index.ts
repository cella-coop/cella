// The graft's writes, reads and slice, which the shell mounts: the trial
// balance on the chart and whether the whole of it agrees, an account's
// ledger on its page, and a company's books imported from its last tool's
// FEC.
import type { Slice } from '@cella/org-db'
import { agrees, balances, ledger } from '../drivers/balance.ts'
import { fec } from './imports.ts'

export { agrees, balances, ledger } from '../drivers/balance.ts'
export { carry } from '../handlers/carry.ts'

export const slice: Slice = {
  name: 'account-transaction',
  imports: { fec },
  extends: {
    accounts: { list: balances, item: ledger, about: agrees },
  },
}
