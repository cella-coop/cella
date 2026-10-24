// The feat's public writes, POST /api/account/<op> once the server exists,
// the write spec a graft composes, its reads, and its slice, which the
// shell mounts.
import { action, type Slice } from '@cella/org-db'
import { close } from '../handlers/index.ts'
import { account, accounts, period, periods } from '../drivers/account.ts'
import { allocation, allocations } from '../drivers/allocation.ts'

export { allocating, close } from '../handlers/index.ts'
export { account, accounts, period, periods } from '../drivers/account.ts'
export { allocation, allocations } from '../drivers/allocation.ts'

// The chart, the periods and the surplus allocations; closing a period,
// which `account.closes` decides and after which nothing posts into it.
// Allocating a surplus posts it, so its write is account-transaction's.
export const slice: Slice = {
  name: 'account',
  collections: {
    accounts: {
      list: accounts,
      item: account,
      index: async (db) => (await accounts(db)).map((a) => ({ id: a.id, title: `${a.code} ${a.label}`, sub: a.kind })),
    },
    periods: {
      list: periods,
      item: period,
      actions: {
        close: action('account:period:close', (_, id) => ({ month: id ?? '' }), close),
      },
    },
    allocations: {
      list: allocations,
      item: allocation,
      index: async (db) => (await allocations(db)).map((a) => ({ id: a.id, title: `${a.year} surplus`, sub: a.allocated ? 'allocated' : 'to allocate' })),
    },
  },
}
