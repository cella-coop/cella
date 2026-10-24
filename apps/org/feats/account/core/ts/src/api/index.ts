// The feat's public writes, POST /api/account/<op> once the server exists,
// its reads, and its slice, which the shell mounts.
import { action, type Slice } from '@cella/org-db'
import { close } from '../handlers/index.ts'
import { account, accounts, period, periods } from '../drivers/account.ts'

export { close } from '../handlers/index.ts'
export { account, accounts, period, periods } from '../drivers/account.ts'

// The chart and the periods; closing a period, which `account.closes`
// decides and after which nothing posts into it.
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
  },
}
