// Every record names its owning circle, on a seeded Lanterne: each table
// of a feat or a graft holds `circle`, never null, a foreign key into
// core's circles that defaults to the root, or is a registry that names
// none; Lanterne's records are owned as its fixtures place them, an
// expense spent for Web Web's and one spent for no circle the
// assembly's; and a write names the circle it names, the root where it
// names none, never one that does not exist. Run by `cella test e2e owning`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { capture } from '@cella/org-expense/api'
import { create } from '@cella/org-document/api'
import type { Deps } from '@cella/org-db'
import { sign } from './lanterne.ts'

const su = new pg.Client()
let app: pg.Client

const camille = 'camille@lanterne.example'
const thomas = 'thomas@lanterne.example'

const as = (actor: string): Deps => ({ db: app, actor, sign: sign(actor) })
const all = async <R>(sql: string, values: unknown[] = []) => (await su.query(sql, values)).rows as R[]

before(async () => {
  await su.connect()
  await su.query(`ALTER ROLE cella_app IN DATABASE ${su.escapeIdentifier(su.database ?? '')} SET cella.clock = '2026-10-24'`)
  app = new pg.Client({ user: 'cella_app' })
  await app.connect()
})

after(async () => {
  await app.end()
  await su.end()
})

// The schemas of the feats and the grafts: every one the migrations
// made but core's, the notary's and the catalog's.
const slices = `n.nspname NOT IN ('cella', 'vault', 'circle', 'policy', 'analytics', 'migration', 'public', 'information_schema') AND n.nspname NOT LIKE 'pg\\_%'`

test('every table of a feat or a graft names its owning circle, never null, keyed into core\'s circles, or is a registry', async () => {
  const tables = await all<{ table: string; circle: boolean; required: boolean; keyed: boolean; fallback: string | null; registry: boolean }>(
    `SELECT n.nspname || '.' || c.relname AS table,
            a.attname IS NOT NULL AS circle,
            coalesce(a.attnotnull, false) AS required,
            EXISTS (
              SELECT FROM pg_constraint k
              WHERE k.conrelid = c.oid AND k.contype = 'f' AND k.confrelid = 'circle.circle'::regclass AND k.conkey = ARRAY[a.attnum] AND k.convalidated
            ) AS keyed,
            pg_get_expr(d.adbin, d.adrelid) AS fallback,
            coalesce(obj_description(c.oid, 'pg_class') LIKE 'registry: _%', false) AS registry
     FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
     LEFT JOIN pg_attribute a ON a.attrelid = c.oid AND a.attname = 'circle' AND NOT a.attisdropped
     LEFT JOIN pg_attrdef d ON d.adrelid = c.oid AND d.adnum = a.attnum
     WHERE c.relkind IN ('r', 'p') AND NOT c.relispartition AND ${slices}
     ORDER BY 1`,
  )
  assert.ok(tables.length > 80, `${tables.length} tables`)
  const registries = tables.filter((t) => t.registry).map((t) => t.table)
  assert.deepEqual(registries, [
    'account.rubric',
    'file_membership.opener',
    'motion.carries',
    'motion.cite_guard',
    'motion.cites',
    'motion.procedure',
    'motion.stance_power',
    'person.rights',
    'report.drawn',
    'transaction.journal',
    'transaction.line_check',
  ])
  // A setting is keyed by its circle, and a generated document names the
  // circle whose policies it reads: neither falls back to the root.
  const named = new Set(['meeting.setting', 'document.generated'])
  for (const t of tables.filter((t) => !t.registry)) {
    assert.deepEqual([t.table, t.circle, t.required, t.keyed], [t.table, true, true, true])
    assert.equal(t.fallback, named.has(t.table) ? null : 'circle.assembly()', t.table)
  }
})

test('Lanterne\'s records are owned as its fixtures place them', async () => {
  assert.deepEqual(await all('SELECT id, circle FROM expense.expense ORDER BY id'), [
    { id: 'ex-0001', circle: 'brand' },
    { id: 'ex-0002', circle: 'web' },
    { id: 'ex-0003', circle: 'marketing' },
    { id: 'ex-0004', circle: 'ag' },
  ])
  assert.deepEqual(await all('SELECT id, circle FROM bill.bill ORDER BY id'), [
    { id: 'bi-0001', circle: 'brand' },
    { id: 'bi-0002', circle: 'ag' },
  ])
  // A project's milestones, a meeting's agenda and a motion's stances are
  // in its circle.
  assert.deepEqual(await all(`SELECT DISTINCT p.circle, m.circle AS part FROM project.project p JOIN project.milestone m ON m.project = p.id WHERE p.id = 'clairval-site'`), [
    { circle: 'web', part: 'web' },
  ])
  assert.deepEqual(await all('SELECT count(*)::int AS n FROM meeting.item i JOIN meeting.meeting m ON m.id = i.meeting WHERE i.circle <> m.circle'), [{ n: 0 }])
  assert.deepEqual(await all('SELECT count(*)::int AS n FROM motion.vote v JOIN motion.motion m ON m.id = v.motion WHERE v.circle <> m.circle'), [{ n: 0 }])
  // The books, pay and membership are the whole co-op's.
  for (const table of ['transaction.entry', 'transaction.line', 'invoice.invoice', 'payslip.payslip', 'membership.member', 'client.client']) {
    assert.deepEqual(await all(`SELECT DISTINCT circle FROM ${table}`), [{ circle: 'ag' }], table)
  }
  // Time is the circle's it is worked for, and a month its first entry's.
  assert.deepEqual(await all(`SELECT DISTINCT circle FROM timesheet.period WHERE member = 'thomas@lanterne.example'`), [{ circle: 'web' }])
})

test('a write names the circle it names, the root where it names none, and never one that does not exist', async () => {
  const train = await capture({ member: thomas, day: '2026-10-23', label: 'Train to Clairval', category: '6251', net: 78_55, vat: 7_85, receipt: null, circle: 'web' }, as(thomas))
  assert.equal(train.state, 'settled')
  const taxi = await capture({ member: thomas, day: '2026-10-23', label: 'Taxi home', category: '6251', net: 20_00, vat: 2_00, receipt: null }, as(thomas))
  assert.equal(taxi.state, 'settled')
  const owned = async (id: string) => (await all<{ circle: string }>('SELECT circle FROM expense.expense WHERE id = $1', [id]))[0]?.circle
  assert.equal(train.state === 'settled' && (await owned(train.value.expense)), 'web')
  assert.equal(taxi.state === 'settled' && (await owned(taxi.value.expense)), 'ag')
  // The log commits to the circle each was captured in.
  assert.equal(train.state === 'settled' && train.value.circle, 'web')
  await assert.rejects(
    capture({ member: thomas, day: '2026-10-23', label: 'Typo', category: '6251', net: 1_00, vat: null, receipt: null, circle: 'wbe' }, as(thomas)),
    /expense_circle_fkey/,
  )

  const brief = await create({ title: 'Brand brief 2027', circle: 'brand', blocks: [{ type: 'paragraph', runs: [{ text: 'What Brand makes next year' }], children: [] }] }, as(camille))
  assert.equal(brief.state, 'settled')
  assert.deepEqual(await all(`SELECT d.circle, u.circle AS part FROM document.document d JOIN document.update u ON u.document = d.id WHERE d.id = 'brand-brief-2027'`), [
    { circle: 'brand', part: 'brand' },
  ])
})
