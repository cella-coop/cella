import type { Outcome } from '@cella/org-actions'
import { write, type Db, type Deps } from '@cella/org-db'
import type { actions } from '../models/actions.ts'
import type { OpenPeriod, PeriodOpened } from '../models/period.ts'

const op = 'account:period:open' satisfies keyof typeof actions

// The month the books open next: the one after the latest they hold, or
// the verdict date's where they hold none.
export async function nextPeriod(db: Db): Promise<OpenPeriod> {
  const { rows } = await db.query<{ month: string }>(
    `SELECT coalesce(to_char(to_date(max(month), 'YYYY-MM') + interval '1 month', 'YYYY-MM'), to_char(cella.verdict_date(), 'YYYY-MM')) AS month
     FROM account.period`,
  )
  return { month: rows[0].month }
}

// Opens a period, so entries dated in it post; opening one already open
// changes nothing. Whether it may open, after the latest and with no gap,
// is `account.opens`'s.
export async function open(input: OpenPeriod, deps: Deps): Promise<Outcome<(typeof actions)[typeof op], PeriodOpened>> {
  return write(deps, {
    op,
    request: input,
    state: async (tx) => {
      await tx.query('INSERT INTO account.period (month) VALUES ($1) ON CONFLICT DO NOTHING', [input.month])
      return { month: input.month }
    },
    payload: (v) => ({ ...v }),
  })
}
