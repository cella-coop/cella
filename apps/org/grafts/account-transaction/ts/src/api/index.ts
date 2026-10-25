// The graft's writes, reads and slice, which the shell mounts: the trial
// balance on the chart, an account's ledger on its page, each span's
// financial statements, and a company's books imported from its last
// tool's FEC.
import type { Slice } from '@cella/org-db'
import { balances, ledger } from '../drivers/balance.ts'
import { figures, statements } from '../drivers/statement.ts'
import { fec } from './imports.ts'

export { balances, ledger } from '../drivers/balance.ts'
export { carry } from '../handlers/carry.ts'
export { figures, statements } from '../drivers/statement.ts'

export const slice: Slice = {
  name: 'account-transaction',
  imports: { fec },
  extends: {
    accounts: { list: balances, item: ledger },
    reports: { list: figures, item: statements },
  },
}
