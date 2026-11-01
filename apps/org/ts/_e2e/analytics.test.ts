// The analytical contracts on a seeded Lanterne, read as the analytics
// shell reads them: the role reaches the views the slices publish and
// nothing else, and may only read them; every view reads; and what they
// share reconciles with what the slices' own reads say, the books to the
// cent, the projects' time to the minute and its cost to the cent, the
// payroll to the cent. Run by `cella test` on a fresh database.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const su = new pg.Client()
const analytics = new pg.Client({ user: 'cella_analytics' })

const all = async <R>(db: pg.Client, sql: string, values: unknown[] = []) => (await db.query(sql, values)).rows as R[]

before(async () => {
  await su.connect()
  await analytics.connect()
})

after(async () => {
  await analytics.end()
  await su.end()
})

// What the role may read: every relation in a schema it may use that it
// holds SELECT on, a column of, or more; and whether only PUBLIC's grant
// opens it.
const reached = () =>
  all<{ rel: string; kind: string; granted: boolean; public: boolean }>(
    su,
    `SELECT format('%I.%I', n.nspname, c.relname) AS rel, c.relkind::text AS kind,
            EXISTS (SELECT FROM aclexplode(c.relacl) a WHERE a.grantee = 'cella_analytics'::regrole) AS granted,
            EXISTS (SELECT FROM aclexplode(c.relacl) a WHERE a.grantee = 0) AS public
     FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE c.relkind IN ('r', 'v', 'm', 'p', 'f') AND n.nspname NOT LIKE 'pg\\_%' AND n.nspname <> 'information_schema'
       AND has_schema_privilege('cella_analytics', n.oid, 'USAGE')
       AND (has_table_privilege('cella_analytics', c.oid, 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE')
            OR EXISTS (SELECT FROM pg_attribute a WHERE a.attrelid = c.oid AND a.attnum > 0
                       AND has_column_privilege('cella_analytics', c.oid, a.attnum, 'SELECT, INSERT, UPDATE')))
     ORDER BY 1`,
  )

test('the role reaches the views the slices publish and nothing else, but what every role reads', async () => {
  const rels = await reached()
  const views = rels.filter((r) => r.granted)
  assert.ok(views.length >= 50, `${views.length} views published`)
  assert.deepEqual(views.filter((r) => r.kind !== 'v').map((r) => r.rel), [], 'only views are granted')
  // The notary opens the erasure's tombstones to every role; nothing else
  // beyond the contracts reaches the role.
  assert.deepEqual(rels.filter((r) => !r.granted).map((r) => `${r.rel}${r.public ? ' (public)' : ''}`), ['vault.erased (public)'])
  const written = await all<{ rel: string }>(
    su,
    `SELECT format('%I.%I', n.nspname, c.relname) AS rel FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE c.relkind IN ('r', 'v', 'p') AND has_table_privilege('cella_analytics', c.oid, 'INSERT, UPDATE, DELETE, TRUNCATE')
       AND NOT EXISTS (SELECT FROM aclexplode(c.relacl) a WHERE a.grantee = 0 AND a.privilege_type <> 'SELECT')`,
  )
  assert.deepEqual(written, [])
  for (const fn of ['cella.begin(text, text, bytea)', 'cella.submit(text, jsonb, text, jsonb)', 'cella.opened(bigint)']) {
    const { rows: [r] } = await su.query<{ may: boolean }>(`SELECT has_function_privilege('cella_analytics', $1, 'EXECUTE') AS may`, [fn])
    assert.equal(r.may, false, fn)
  }
})

test('the role logs in read-only and every view it is granted reads', async () => {
  const { rows: [r] } = await analytics.query<{ default_transaction_read_only: string }>('SHOW default_transaction_read_only')
  assert.equal(r.default_transaction_read_only, 'on')
  for (const { rel } of (await reached()).filter((v) => v.granted)) {
    await analytics.query(`SELECT * FROM ${rel} LIMIT 1`)
  }
  for (const rel of ['account_transaction.movements', 'invoice.invoices', 'timesheet.months', 'project_timesheet.months', 'payslip.months', 'membership.members', 'person.people', 'project.projects', 'motion.motions']) {
    const { rows: [n] } = await analytics.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${rel}`)
    assert.ok(n.n > 0, `${rel} holds Lanterne's rows`)
  }
  await assert.rejects(analytics.query('SELECT * FROM transaction.line LIMIT 1'), /permission denied/)
})

test('the books by account reconcile with the trial balance to the cent, a capital account summed into its parent', async () => {
  const [m] = await all<{ debit: string; credit: string }>(analytics, 'SELECT sum(debit)::text AS debit, sum(credit)::text AS credit FROM account_transaction.movements')
  assert.equal(m.debit, m.credit)
  assert.deepEqual(await all(analytics, 'SELECT sum(debit)::text AS debit, sum(credit)::text AS credit FROM transaction.months'), [m])
  // Each account's lines, as the graft's own balance reads them, folded
  // as the contract folds them: a held account into its parent.
  const balances = await all<{ code: string; debit: string; credit: string }>(
    su,
    `SELECT CASE WHEN a.holder IS NULL THEN b.code ELSE a.parent END AS code, sum(b.debit)::text AS debit, sum(b.credit)::text AS credit
     FROM account_transaction.balance b JOIN account.account a ON a.code = b.code
     GROUP BY 1 HAVING sum(b.debit) + sum(b.credit) > 0 ORDER BY 1`,
  )
  const moved = await all(analytics, 'SELECT code, sum(debit)::text AS debit, sum(credit)::text AS credit FROM account_transaction.movements GROUP BY code ORDER BY code')
  assert.deepEqual(moved, balances)
  const held = await all<{ code: string }>(su, 'SELECT code FROM account.account WHERE holder IS NOT NULL')
  assert.ok(held.length > 0, 'Lanterne holds capital accounts')
  const shown = await all(analytics, 'SELECT code FROM account_transaction.movements WHERE code = ANY($1) UNION SELECT code FROM account.chart WHERE code = ANY($1)', [held.map((h) => h.code)])
  assert.deepEqual(shown, [], 'no row is a member\'s capital account')
})

test('each project\'s time by month adds up to its burn: minutes, and spent and cost to the cent', async () => {
  const burn = await all<{ project: string; hours: string; billable: string; spent: string; cost: string }>(
    su,
    'SELECT project, hours::text, billable::text, spent::text, cost::text FROM project_timesheet.burn ORDER BY project',
  )
  assert.ok(burn.length > 0)
  const months = await all(
    analytics,
    `SELECT project, (sum(minutes) / 60.0)::numeric(8, 2)::text AS hours, (sum(billable) / 60.0)::numeric(8, 2)::text AS billable,
            round(sum(spent))::bigint::text AS spent, round(sum(cost))::bigint::text AS cost
     FROM project_timesheet.months GROUP BY project ORDER BY project`,
  )
  assert.deepEqual(months, burn)
})

test('the payroll by month adds up to every payslip, to the cent', async () => {
  const [slips] = await all(su, `SELECT count(*)::text AS n, sum(cella.cents(gross))::text AS gross, sum(cella.cents(net))::text AS net FROM payslip.payslip`)
  const [months] = await all(analytics, 'SELECT sum(payslips)::text AS n, sum(gross)::text AS gross, sum(net)::text AS net FROM payslip.months')
  assert.deepEqual(months, slips)
})
