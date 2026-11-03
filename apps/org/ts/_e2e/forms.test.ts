// A legal form and its region supply default policies, and the co-op sees
// where it left them, end to end on a seeded Lanterne, through the
// handlers: its founding motion took the SCOP SARL's defaults, which its
// circle's page marks, and its statutes leave none; a policy taking a
// default worded otherwise, or one taken already, is refused as it is
// proposed; an ordinary assembly's motion ending one default and
// replacing another with Lanterne's own marks each left, by its action,
// on the motion's page, the circle's and in the statutes generated anew;
// and a later update of the form marks a default taken as updated,
// restores none left and changes no policy, its new wording taken only by
// a motion. Run by `cella test e2e forms`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { motion as detail, vote } from '@cella/org-motion/api'
import { close, propose } from '@cella/org-graft-circle-membership-motion/api'
import { proposing } from '@cella/org-graft-circle-motion/api'
import type { Deps } from '@cella/org-db'
import { sign } from './lanterne.ts'
import { react } from '../src/lib/server/slices.ts'

const su = new pg.Client()
let app: pg.Client

const at = (name: string) => `${name}@lanterne.example`
const camille = at('camille')
const assembly = ['camille', 'yusuf', 'hugo', 'malik', 'julien', 'amina', 'thomas', 'lea', 'chloe', 'sofia'].map(at)

async function on(date: string) {
  await su.query(`ALTER ROLE cella_app IN DATABASE ${su.escapeIdentifier(su.database ?? '')} SET cella.clock = '${date}'`)
  await app?.end()
  app = new pg.Client({ user: 'cella_app' })
  await app.connect()
}

const as = (actor: string): Deps => ({ db: app, actor, sign: sign(actor) })
const all = async <R>(sql: string, values: unknown[] = []) => (await su.query(sql, values)).rows as R[]
const one = async <R>(sql: string, values: unknown[] = []) => (await all<R>(sql, values))[0]
const reason = (out: { state: string; reason?: string }) => (out.state === 'refused' ? (out.reason ?? '') : '')
const settled = <T>(out: { state: string; value?: T; reason?: string }): T => {
  assert.equal(out.state, 'settled', reason(out))
  return out.value as T
}

// The adopted statutes, line by line.
const statutes = async () =>
  (
    await one<{ version: string; plain: string }>(
      `SELECT v.id AS version, v.plain FROM document.adopted a JOIN document.version v ON v.id = a.version WHERE a.document = 'statutes'`,
    )
  )
// Where each default stands in the assembly today.
const standing = async () =>
  new Map(
    (
      await all<{ id: string; standing: string; left_by: string | null; left_on: string | null }>(
        `SELECT id, standing, left_by, to_char(left_on, 'YYYY-MM-DD') AS left_on FROM policy.standing('ag', '2026-11-21')`,
      )
    ).map((s) => [s.id, s]),
  )

const workShare = "At least {work_share: 25 % | more is stricter} of each year's surplus goes to all the employees as the work share"
const admitting = 'The {circle: ag} circle holds {power: admit-member}, to admit members, by motion'

let leaving = ''

before(async () => {
  await su.connect()
  await on('2026-11-07')
})

after(async () => {
  await app.end()
  await su.end()
})

test('Lanterne\'s policies show which are the SCOP SARL\'s defaults, and its statutes leave none', async () => {
  const page = await proposing(app, 'ag')
  assert.ok(page)
  const taking = page.policies.filter((p) => p.takes)
  assert.equal(taking.length, 35)
  assert.ok(taking.every((p) => p.takes?.startsWith('scop-sarl-fr:') && !p.outdated))
  assert.equal(page.policies.find((p) => p.id === 'm-2021-001/5')?.takes, 'scop-sarl-fr:ordinary')
  // Its role mandates and its terms are its own.
  assert.equal(page.policies.find((p) => p.id === 'm-2021-001/12')?.takes, null)
  assert.equal(page.policies.find((p) => p.id === 'm-2021-001/43')?.takes, null)
  assert.deepEqual(page.departures, [])
  assert.deepEqual(await all(`SELECT standing, count(*)::int AS n FROM policy.standing('ag', '2026-11-07') GROUP BY 1`), [{ standing: 'taken', n: 35 }])
  assert.deepEqual(await all(`SELECT * FROM policy.standing('coordination', '2026-11-07')`), [])
  assert.ok((await statutes()).plain.split('\n').includes('These statutes leave none of their legal form\'s defaults.'))
  // Each default that states the law names it, and none is reviewed yet.
  assert.deepEqual(
    await one(`SELECT count(*) FILTER (WHERE source IS NOT NULL)::int AS sourced, count(*) FILTER (WHERE reviewed IS NOT NULL)::int AS reviewed FROM policy.default`),
    { sourced: 13, reviewed: 0 },
  )
})

test('a policy taking a default worded otherwise, or one taken already, is refused as it is proposed', async () => {
  const proposal = (args: Record<string, string>, procedure = 'ordinary') =>
    propose(
      { circle: 'ag', title: 'The work share', procedure, deadline: '2026-11-21', body: '', actions: [{ kind: 'policy', args }] },
      as(camille),
    )
  const otherwise = await proposal({ kind: 'rule', wording: workShare.replace('25 %', '30 %'), takes: 'scop-sarl-fr:work-share', replaces: 'm-2021-001/74' })
  assert.match(reason(otherwise), /a policy takes scop-sarl-fr:work-share worded as it reads: one worded otherwise takes no default/)
  const again = await proposal({ kind: 'rule', wording: workShare, friendly: 'At least a quarter of the surplus goes to the workers.', takes: 'scop-sarl-fr:work-share' })
  assert.match(reason(again), /m-2021-001\/74 takes scop-sarl-fr:work-share already: a policy taking it again replaces that one/)
  const unprotected = await proposal({ kind: 'mandate', wording: 'Every {right: person} holds {power: mark-read}, to mark a text the co-op adopted read', takes: 'scop-sarl-fr:mark-read', replaces: 'm-2021-001/67' }, 'extraordinary')
  assert.match(reason(unprotected), /scop-sarl-fr:mark-read is protected by extraordinary: a policy takes it protected as it is/)
})

test('an ordinary assembly\'s motion leaving two defaults marks each left, by its action, on the motion\'s page, the circle\'s and in the statutes', async () => {
  const { motion } = settled(
    await propose(
      {
        circle: 'ag',
        title: 'No suspensions, and a larger work share',
        procedure: 'ordinary',
        deadline: '2026-11-21',
        body: 'The assembly stops suspending members, and gives the workers 40 % of each surplus at least.',
        actions: [
          { kind: 'end', args: { policy: 'm-2021-001/48' } },
          { kind: 'policy', args: { kind: 'rule', wording: workShare.replace('25 %', '40 %'), replaces: 'm-2021-001/74' } },
        ],
      },
      as(camille),
    ),
  )
  leaving = motion
  for (const [i, member] of assembly.entries()) {
    settled(await vote({ motion, member, stance: i < 8 ? 'for' : 'against' }, as(member)))
  }
  await on('2026-11-21')
  const before = await statutes()
  settled(await close({ motion }, as(camille)))
  const then = await react('motion:motion:close', { motion }, as(camille))
  const states = (ds: typeof then): string[] => ds.flatMap((d) => [`${d.op} ${d.state} ${d.reason ?? ''}`.trim(), ...states(d.then)])
  assert.ok(states(then).every((s) => s.includes(' settled')), states(then).join('\n'))
  assert.ok(states(then).includes('document:document:generate settled'))

  const s = await standing()
  assert.deepEqual(s.get('scop-sarl-fr:suspend-member'), { id: 'scop-sarl-fr:suspend-member', standing: 'left', left_by: `${motion}/1`, left_on: '2026-11-21' })
  assert.deepEqual(s.get('scop-sarl-fr:work-share'), { id: 'scop-sarl-fr:work-share', standing: 'left', left_by: `${motion}/2`, left_on: '2026-11-21' })
  assert.equal([...s.values()].filter((d) => d.standing === 'taken').length, 33)

  const page = await detail(app, motion)
  assert.deepEqual(
    page?.leaves.map((l) => [l.id, l.form, l.action, l.sentence]),
    [
      ['scop-sarl-fr:suspend-member', 'SCOP SARL, France', `${motion}/1`, 'The ag circle holds suspend-member, to suspend a member, by motion'],
      ['scop-sarl-fr:work-share', 'SCOP SARL, France', `${motion}/2`, 'At least 25 % of each year\'s surplus goes to all the employees as the work share'],
    ],
  )
  const circle = await proposing(app, 'ag')
  assert.deepEqual(circle?.departures.map((d) => [d.id, d.standing, d.leftBy]), [
    ['scop-sarl-fr:suspend-member', 'left', `${motion}/1`],
    ['scop-sarl-fr:work-share', 'left', `${motion}/2`],
  ])
  assert.equal(circle?.policies.find((p) => p.id === `${motion}/2`)?.takes, null)

  const after = await statutes()
  assert.notEqual(after.version, before.version)
  const lines = after.plain.split('\n')
  assert.ok(lines.includes(`Leaves the SCOP SARL, France default, by ${motion}/1: The ag circle holds suspend-member, to suspend a member, by motion.`), after.plain)
  assert.ok(lines.includes(`Leaves the SCOP SARL, France default, by ${motion}/2: At least 25 % of each year's surplus goes to all the employees as the work share.`))
  assert.ok(lines.includes('At least 40 % of each year\'s surplus goes to all the employees as the work share'))
  assert.ok(!lines.includes('These statutes leave none of their legal form\'s defaults.'))
})

test('a later update of the form marks a default taken as updated, restores none left, and its new wording is taken only by a motion', async () => {
  const before = await statutes()
  const offer = (key: string, kind: string, legal: string, protect: string | null, source: string | null) =>
    su.query('SELECT policy.offer($1, $2, $3, $4, NULL, $5, $6)', ['scop-sarl-fr', key, kind, legal, protect, source])
  await su.query('SET cella.unbound = on')
  await offer('admit-member', 'mandate', 'The {circle: ag} circle holds {power: admit-member}, to admit members on the statutes\' conditions, by motion', null, 'loi n° 47-1775 art. 7')
  await offer('suspend-member', 'mandate', 'The {circle: ag} circle holds {power: suspend-member}, to suspend a member for a term, by motion', null, null)
  await offer('work-share', 'rule', workShare.replace('each year\'s surplus', 'each year\'s net surplus'), null, 'loi n° 78-763 art. 33')
  await su.query('RESET cella.unbound')

  const s = await standing()
  assert.equal(s.get('scop-sarl-fr:admit-member')?.standing, 'updated')
  assert.deepEqual(s.get('scop-sarl-fr:suspend-member'), { id: 'scop-sarl-fr:suspend-member', standing: 'left', left_by: `${leaving}/1`, left_on: '2026-11-21' })
  assert.deepEqual(s.get('scop-sarl-fr:work-share'), { id: 'scop-sarl-fr:work-share', standing: 'left', left_by: `${leaving}/2`, left_on: '2026-11-21' })
  // No policy follows the update by itself: none takes the left defaults
  // again, the mandate stays revoked, and the statutes stand as adopted.
  assert.equal((await one<{ n: number }>(`SELECT count(*)::int AS n FROM policy.in_force('ag', '2026-11-21') WHERE takes IN ('scop-sarl-fr:suspend-member', 'scop-sarl-fr:work-share')`)).n, 0)
  assert.equal((await one<{ revoked: boolean }>(`SELECT revoked IS NOT NULL AS revoked FROM circle.mandate WHERE policy = 'm-2021-001/48'`)).revoked, true)
  assert.equal((await statutes()).version, before.version)
  const page = await proposing(app, 'ag')
  assert.equal(page?.policies.find((p) => p.id === 'm-2021-001/47')?.outdated, true)
  assert.deepEqual(page?.departures.map((d) => d.id), ['scop-sarl-fr:suspend-member', 'scop-sarl-fr:work-share'])

  const taking = (wording: string) =>
    propose(
      {
        circle: 'ag',
        title: 'Admit on the statutes\' conditions',
        procedure: 'ordinary',
        deadline: '2026-12-05',
        body: '',
        actions: [{ kind: 'policy', args: { kind: 'mandate', wording, takes: 'scop-sarl-fr:admit-member', replaces: 'm-2021-001/47' } }],
      },
      as(camille),
    )
  assert.match(reason(await taking(admitting)), /a policy takes scop-sarl-fr:admit-member worded as it reads/)
  settled(await taking('The {circle: ag} circle holds {power: admit-member}, to admit members on the statutes\' conditions, by motion'))
})

test('the log verifies', async () => {
  assert.equal((await one<{ v: boolean }>('SELECT cella.verify_log() AS v')).v, true)
})
