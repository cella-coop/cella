// The graft's writes, reads and slice, which the shell mounts: the trial
// balance on the chart, an account's ledger on its page, and a surplus
// allocated and posted in one write.
import { action, type Slice } from '@cella/org-db'
import { balances, ledger, posted } from '../drivers/balance.ts'
import { allocate } from '../handlers/allocate.ts'

export { balances, ledger, posted } from '../drivers/balance.ts'
export { allocate } from '../handlers/allocate.ts'

export const slice: Slice = {
  name: 'account-transaction',
  extends: {
    accounts: { list: balances, item: ledger },
    allocations: {
      item: posted,
      actions: {
        allocate: action('account:surplus:allocate', (form, id) => ({ allocation: id ?? '', decision: form.get('decision') }), allocate),
      },
    },
  },
}
