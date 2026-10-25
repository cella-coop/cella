// The feat's public writes, POST /api/account/<op> once the server exists,
// the write spec a graft composes, its reads, and its slice, which the
// shell mounts.
import { action, type Slice } from '@cella/org-db'
import { adopt, close } from '../handlers/index.ts'
import { account, accounts, period, periods } from '../drivers/account.ts'
import { term, terms } from '../drivers/terms.ts'
import { report, reports } from '../drivers/report.ts'

export { adopt, close, opening } from '../handlers/index.ts'
export { account, accounts, period, periods } from '../drivers/account.ts'
export { term, terms } from '../drivers/terms.ts'
export { report, reports } from '../drivers/report.ts'

// The chart, the periods, the statutes' capital clauses and the spans the
// financial statements are drawn for; closing a period, which
// `account.closes` decides and after which nothing posts into it, and
// adopting capital clauses, which cites the members' decision.
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
    terms: {
      list: terms,
      item: term,
      actions: {
        adopt: action('account:terms:adopt', (form, id) => ({ terms: id ?? '', decision: form.get('decision') }), adopt),
      },
    },
    reports: {
      list: reports,
      item: report,
      index: async (db) => (await reports(db)).map((r) => ({ id: r.id, title: `${r.id} financial statements`, sub: r.kind })),
    },
  },
}
