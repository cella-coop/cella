// The books and pay fold, end to end on a seeded Lanterne: October's
// time submitted and approved, its pay run prepared, approved and paid;
// a draw; time logged and corrected; an entry posted, a supplier paid and
// a correction posted; and the next month opened and October closed. Then
// the log folds into a fresh database that matches it row for row, every
// table of the books and pay among them (architecture.md, "Folds"). Run
// by `cella test e2e ledger`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { close, nextPeriod, open } from '@cella/org-account/api'
import { draw } from '@cella/org-graft-account-membership-transaction/api'
import { generate } from '@cella/org-graft-payslip-timesheet/api'
import { approve as approveRun, pay as payRun } from '@cella/org-graft-payslip-transaction/api'
import { approve as approveTime, correct, log as logTime, submit as submitTime } from '@cella/org-timesheet/api'
import { adjust, pay as paySupplier, post } from '@cella/org-transaction/api'
import type { Deps } from '@cella/org-db'
import { folded, tables, unfold } from './fold.ts'
import { reader, sign } from './lanterne.ts'

const su = new pg.Client()
let app: pg.Client

const camille = 'camille@lanterne.example'
const julien = 'julien@lanterne.example'
const thomas = 'thomas@lanterne.example'

async function on(date: string) {
  await su.query(`ALTER ROLE cella_app IN DATABASE ${su.escapeIdentifier(su.database ?? '')} SET cella.clock = '${date}'`)
  await app?.end()
  app = new pg.Client({ user: 'cella_app' })
  await app.connect()
}

const as = (actor: string): Deps => ({ db: reader(app, actor), actor, sign: sign(actor) })
const all = async <R>(sql: string, values: unknown[] = []) => (await su.query(sql, values)).rows as R[]
const reason = (out: { state: string; reason?: string }) => (out.state === 'refused' ? out.reason ?? '' : '')
const settled = (out: { state: string; reason?: string }) => assert.equal(out.state, 'settled', reason(out))

before(async () => {
  await su.connect()
  await on('2026-11-02')
})

after(async () => {
  await app.end()
  await su.end()
})

test('October\'s time is submitted and approved, and its run prepared, approved and paid', async () => {
  const members = (await all<{ member: string }>(`SELECT member FROM payslip.salary WHERE "from" <= '2026-10-01' GROUP BY member ORDER BY member`)).map((r) => r.member)
  for (const m of members) {
    for (const { circle, submitted } of await all<{ circle: string; submitted: string | null }>(`SELECT circle, submitted FROM timesheet.period WHERE member = $1 AND month = '2026-10'`, [m])) {
      // Sofia's brand month is submitted already.
      if (!submitted) settled(await submitTime({ member: m, month: '2026-10', circle }, as(m)))
      // Camille's own, in coordination and the assembly, the treasurer's,
      // whose approve-time holds on the whole co-op as no lead's does.
      settled(await approveTime({ member: m, month: '2026-10', circle }, as(m === camille ? julien : camille)))
    }
  }
  settled(await generate({ month: '2026-10' }, as(julien)))
  settled(await approveRun({ month: '2026-10' }, as(camille)))
  settled(await payRun({ month: '2026-10' }, as(julien)))
})

test('Thomas draws on his account, and logs time he then corrects', async () => {
  settled(await draw({ member: thomas, cents: 300_00 }, as(thomas)))
  const time = await logTime({ member: thomas, day: '2026-11-02', minutes: 90, billable: true, note: 'Proofs for the Halles shop' }, as(thomas))
  settled(time)
  settled(await correct({ entry: time.state === 'settled' ? time.value.entry : '', minutes: 60 }, as(thomas)))
})

test('Julien posts an entry, pays a supplier and corrects the entry', async () => {
  const posted = await post(
    {
      date: '2026-11-02',
      label: 'Supplies, November',
      lines: [
        { account: '606', side: 'debit', cents: 12_00 },
        { account: '401', side: 'credit', cents: 12_00 },
      ],
    },
    as(julien),
  )
  settled(posted)
  settled(await paySupplier({ date: '2026-11-02', label: 'Paper for the proofs', cents: 80_00 }, as(julien)))
  const corrected = posted.state === 'settled' ? posted.value.entry : ''
  settled(
    await adjust(
      {
        corrects: corrected,
        base: null,
        entry: {
          date: '2026-11-02',
          label: `Supplies, November, corrected (${corrected})`,
          lines: [
            { account: '401', side: 'debit', cents: 2_00 },
            { account: '606', side: 'credit', cents: 2_00 },
          ],
        },
      },
      as(julien),
    ),
  )
})

test('Julien opens the books\' next month and closes October', async () => {
  settled(await open(await nextPeriod(app), as(julien)))
  settled(await close({ month: '2026-10' }, as(julien)))
})

test('the log folds into a fresh database that matches it row for row, the books and pay among it', async () => {
  const db = process.env.PGDATABASE ?? 'cella'
  try {
    assert.match(folded(db), / transaction folded, \S+ matches \S+ row for row/)
    const [source, fold] = [await tables(db), await tables(`${db}_fold`)]
    assert.deepEqual(Object.keys(source).filter((t) => source[t] !== fold[t]).sort(), [])
  } finally {
    await unfold(db)
  }
})
