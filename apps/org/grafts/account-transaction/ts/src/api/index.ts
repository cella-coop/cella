// The graft's reads and its slice, which the shell mounts: the trial
// balance on the chart, and an account's ledger on its page.
import type { Slice } from '@cella/org-db'
import { balances, ledger } from '../drivers/balance.ts'

export { balances, ledger } from '../drivers/balance.ts'

export const slice: Slice = {
  name: 'account-transaction',
  extends: {
    accounts: { list: balances, item: ledger },
  },
}
