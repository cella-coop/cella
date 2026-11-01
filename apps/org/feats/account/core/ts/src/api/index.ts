// The feat's public writes, POST /api/account/<op> once the server exists,
// the write spec a graft composes, its reads, and its slice, which the
// shell mounts.
import { action, type Slice } from '@cella/org-db'
import { close, nextPeriod, open } from '../handlers/index.ts'
import { account, accounts, chart, period, periods } from '../drivers/account.ts'
import { term, terms } from '../drivers/terms.ts'

export { adopt, close, freeze, freezeOwn, freezing, holding, nextPeriod, open, opening } from '../handlers/index.ts'
export { account, accounts, period, periods } from '../drivers/account.ts'
export { term, terms } from '../drivers/terms.ts'
export { report, reports } from '../drivers/report.ts'

// The chart, the periods and the statutes' capital clauses; opening the
// next period, and
// closing one, which `account.closes` decides and after which nothing
// posts into it. Capital clauses are copied from the rule a motion adopts,
// by `adopt`, which account-motion carries.
export const slice: Slice = {
  name: 'account',
  collections: {
    accounts: {
      list: chart,
      item: account,
      index: async (db) => (await accounts(db)).map((a) => ({ id: a.id, title: `${a.code} ${a.label}`, sub: a.kind })),
    },
    periods: {
      list: periods,
      item: period,
      // The month the books open next.
      about: async (db) => nextPeriod(db),
      actions: {
        open: action('account:period:open', (form) => ({ month: form.get('month') }), open),
        close: action('account:period:close', (_, id) => ({ month: id ?? '' }), close),
      },
    },
    terms: {
      list: terms,
      item: term,
    },
  },
}
