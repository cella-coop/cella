// A generated document never goes back, end to end on a seeded Lanterne,
// through the handlers: the assembly adopts a rule to apply on 1 January,
// and the statutes are generated anew as statutes@3, reading that day.
// The founding motion and its day, cited again, are refused, naming the
// version that cites it; the statutes stay at statutes@3. A rule then
// adopted to apply on 20 December generates a version that reads 1
// January, and so both rules, never the 20th, which would drop the
// January one; the January motion, cited again once that version is
// adopted, is refused. A motion whose
// generation never ran, cited later by hand, reads the adopted version's
// day too. A motion that ends a rule and adopts another generates a
// version for each, in a row, both citing it, the second reading both
// changes; and a motion's second change, cited once another motion's
// version is adopted after its first, is refused, naming the version its
// first change made; and a motion's three policy changes generate three
// versions in a row, each citing it, the third reading all three. Run by
// `cella test e2e generated`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { close, propose } from '@cella/org-graft-membership-motion/api'
import { adopt, vote } from '@cella/org-motion/api'
import { generate } from '@cella/org-document/api'
import { done, type Deps, type Done } from '@cella/org-db'
import { reader, sign } from './lanterne.ts'
import { reacting } from '../src/lib/server/slices.ts'

const su = new pg.Client()
let app: pg.Client

const camille = 'camille@lanterne.example'

async function on(date: string) {
  await su.query(`ALTER ROLE cella_app IN DATABASE ${su.escapeIdentifier(su.database ?? '')} SET cella.clock = '${date}'`)
  await app?.end()
  app = new pg.Client({ user: 'cella_app' })
  await app.connect()
}

const as = (actor: string): Deps => ({ db: reader(app, actor), actor, sign: sign(actor) })
const all = async <R>(sql: string, values: unknown[] = []) => (await su.query(sql, values)).rows as R[]
const one = async <R>(sql: string, values: unknown[] = []) => (await all<R>(sql, values))[0]
const reason = (out: { state: string; reason?: string }) => (out.state === 'refused' ? out.reason ?? '' : '')
const settled = <T>(out: { state: string; value?: T; reason?: string }): T => {
  assert.equal(out.state, 'settled', reason(out))
  return out.value as T
}

const adopted = async () => (await one<{ version: string }>(`SELECT version FROM document.adopted WHERE document = 'statutes'`)).version
const linesOf = async (v: string) => (await one<{ plain: string }>('SELECT plain FROM document.version WHERE id = $1', [v])).plain.split('\n')
const says = async (policy: string) => (await one<{ s: string }>('SELECT circle_policy.says($1) AS s', [policy])).s
const cites = (version: string) =>
  all<{ motion: string; day: string }>(`SELECT motion, to_char(day, 'YYYY-MM-DD') AS day FROM document.generation WHERE version = $1 ORDER BY motion`, [version])

type Action = { kind: string; args: Record<string, string> }

// The assembly decides a motion's actions, every member of its roll
// consenting, closed on `deadline`, with what its close carries in its
// transaction, unless `carry` is false, as for a motion whose generation
// never ran.
const closes = new Map<string, Done[]>()
async function motioned(title: string, actions: Action[], deadline: string, carry = true): Promise<string> {
  const motion = settled(await propose({ circle: 'ag', title, procedure: 'consent', deadline, body: '', actions }, as(camille))).motion
  for (const { member } of await all<{ member: string }>(
    `SELECT r.member FROM motion.roll r JOIN membership.member m ON m.address = r.member WHERE r.motion = $1 AND m.status = 'active'`,
    [motion],
  )) {
    settled(await vote({ motion, member, stance: 'consent' }, as(member)))
  }
  await on(deadline)
  const closed = await close({ motion }, carry ? reacting(as(camille)) : as(camille))
  settled(closed)
  closes.set(motion, done('motion:motion:close', closed).then)
  return motion
}

// The assembly decides a rule to apply from `from`.
const decided = (wording: string, from: string, deadline: string, carry = true) =>
  motioned(wording, [{ kind: 'policy', args: { kind: 'rule', wording, from } }], deadline, carry)

const applies = async (policy: string) =>
  (await one<{ day: string }>(`SELECT to_char(applies, 'YYYY-MM-DD') AS day FROM policy.policy WHERE id = $1`, [policy])).day

// What its close carried: the adoption, and the statutes generated.
async function carried(motion: string) {
  const then = closes.get(motion) ?? []
  assert.deepEqual(
    then.map((d) => [d.op, d.state, d.then.map((t) => [t.op, t.state, t.reason ?? ''])]),
    [['motion:policy:adopt', 'settled', [['document:document:generate', 'settled', '']]]],
  )
}

let january = ''
let later = ''

before(async () => {
  await su.connect()
  await on('2026-12-08')
})

after(async () => {
  await app.end()
  await su.end()
})

test('a rule adopted to apply on 1 January generates statutes@3, which cites its motion and reads that day', async () => {
  assert.equal(await adopted(), 'statutes@2')
  january = await decided('Coordination meets on the first Monday of each month', '2027-01-01', '2026-12-15')
  await carried(january)
  assert.equal(await adopted(), 'statutes@3')
  assert.deepEqual(await cites('statutes@3'), [{ motion: january, day: '2027-01-01' }])
  assert.ok((await linesOf('statutes@3')).includes(await says(`${january}/1`)))
})

test('the founding motion and its day, cited again, are refused naming the version that cites it', async () => {
  const founding = await one<{ motion: string; day: string }>(
    `SELECT motion, to_char(applies, 'YYYY-MM-DD') AS day FROM policy.policy WHERE id = 'm-2021-001/43'`,
  )
  const citing = (await one<{ version: string }>(`SELECT version FROM document.generation WHERE document = 'statutes' AND motion = $1`, [founding.motion])).version
  assert.equal(citing, 'statutes@1')
  const replayed = await generate({ document: 'statutes', motion: founding.motion, day: founding.day }, as(camille))
  assert.match(reason(replayed), new RegExp(`${citing} cites ${founding.motion}, and statutes@3 is adopted since: a generation cites a motion that changed the policies after it`))
  assert.equal(await adopted(), 'statutes@3')
  assert.equal((await one<{ n: string }>(`SELECT count(*) AS n FROM document.version WHERE document = 'statutes'`)).n, '3')
})

test('a rule adopted after it to apply on 20 December generates a version reading 1 January, and so both rules; the January motion is cited no more', async () => {
  const december = await decided('Each circle keeps the minutes of its meetings for ten years', '2026-12-20', '2026-12-18')
  await carried(december)
  assert.equal(await adopted(), 'statutes@4')
  assert.deepEqual(await cites('statutes@4'), [{ motion: december, day: '2027-01-01' }])
  const lines = await linesOf('statutes@4')
  assert.ok(lines.includes(await says(`${january}/1`)), 'statutes@4 still reads the January rule')
  assert.ok(lines.includes(await says(`${december}/1`)), 'and reads the December one')
  const logged = await one<{ day: string }>(`SELECT form ->> 'day' AS day FROM cella.log WHERE op = 'document:document:generate' AND form ->> 'version' = 'statutes@4'`)
  assert.equal(logged.day, '2026-12-20', 'the entry cites the day the motion\'s change applies')
  const again = await generate({ document: 'statutes', motion: january, day: '2027-01-01' }, as(camille))
  assert.match(reason(again), new RegExp(`statutes@3 cites ${january}, and statutes@4 is adopted since`))
  assert.equal(await adopted(), 'statutes@4')
})

test('a motion whose generation never ran, cited later by hand, reads the adopted version\'s day', async () => {
  later = await decided('The manager reports to the assembly each quarter', '2026-12-22', '2026-12-21', false)
  settled(await adopt({ motion: later, n: 1 }, as(camille)))
  assert.equal(await adopted(), 'statutes@4')
  settled(await generate({ document: 'statutes', motion: later, day: '2026-12-22' }, as(camille)))
  assert.equal(await adopted(), 'statutes@5')
  assert.deepEqual(await cites('statutes@5'), [{ motion: later, day: '2027-01-01' }])
  const lines = await linesOf('statutes@5')
  for (const p of [`${january}/1`, `${later}/1`]) {
    assert.ok(lines.includes(await says(p)), `statutes@5 reads ${p}`)
  }
})

test('a motion that ends a rule and adopts another generates a version for each in a row, both citing it, the second reading both changes', async () => {
  const minutes = 'Each circle publishes its minutes to every member within a week'
  // The quarterly rule is in force from 22 December, so only then ended.
  await on('2026-12-22')
  const both = await motioned(
    'The quarterly report gives way to published minutes',
    [
      { kind: 'end', args: { policy: `${later}/1` } },
      { kind: 'policy', args: { kind: 'rule', wording: minutes } },
    ],
    '2026-12-28',
  )
  const then = closes.get(both) ?? []
  assert.deepEqual(
    then.map((d) => [d.op, d.state, d.then.map((t) => [t.op, t.state, t.reason ?? ''])]),
    [
      ['motion:policy:end', 'settled', [['document:document:generate', 'settled', '']]],
      ['motion:policy:adopt', 'settled', [['document:document:generate', 'settled', '']]],
    ],
  )
  assert.equal(await adopted(), 'statutes@7')
  assert.deepEqual(await cites('statutes@6'), [{ motion: both, day: '2027-01-01' }])
  assert.deepEqual(await cites('statutes@7'), [{ motion: both, day: '2027-01-01' }])
  // The close's changes both settle before either generation runs, so the
  // second version is generated from the first, and reads both changes.
  assert.equal((await one<{ base: string }>(`SELECT base FROM document.adoption WHERE version = 'statutes@7'`)).base, 'statutes@6')
  const second = await linesOf('statutes@7')
  assert.ok(!second.includes(await says(`${later}/1`)), 'statutes@7 reads the end')
  assert.ok(second.includes(await says(`${both}/2`)), 'and the adoption')
  assert.ok(second.includes(await says(`${january}/1`)), 'and the January rule still')
})

test('a motion\'s second change, cited once another motion\'s version is adopted after its first, is refused naming the version its first change made', async () => {
  const two = await motioned(
    'Two rules for the archive',
    [
      { kind: 'policy', args: { kind: 'rule', wording: 'The archive keeps every adopted text for as long as the co-op stands' } },
      { kind: 'policy', args: { kind: 'rule', wording: 'Any member may read the archive on request' } },
    ],
    '2027-01-04',
    false,
  )
  settled(await adopt({ motion: two, n: 1 }, as(camille)))
  settled(await generate({ document: 'statutes', motion: two, day: await applies(`${two}/1`) }, as(camille)))
  assert.equal(await adopted(), 'statutes@8')
  assert.deepEqual(await cites('statutes@8'), [{ motion: two, day: '2027-01-04' }])
  await carried(await decided('The assembly meets at least twice a year', '2027-01-06', '2027-01-06'))
  assert.equal(await adopted(), 'statutes@9')
  settled(await adopt({ motion: two, n: 2 }, as(camille)))
  const late = await generate({ document: 'statutes', motion: two, day: await applies(`${two}/2`) }, as(camille))
  assert.match(reason(late), new RegExp(`statutes@8 cites ${two}, and statutes@9 is adopted since: a generation cites a motion that changed the policies after it`))
  assert.equal(await adopted(), 'statutes@9')
  assert.equal((await one<{ n: string }>(`SELECT count(*) AS n FROM document.version WHERE document = 'statutes'`)).n, '9')
})

test('a motion\'s three policy changes generate three versions in a row, each citing it, the third reading all three', async () => {
  const rules = [
    'Each circle names a member who keeps its minutes',
    'The minutes of each meeting are published within a week',
    'Any member may ask a circle for its minutes of the last ten years',
  ]
  const three = await motioned(
    'Three rules for the minutes',
    rules.map((wording) => ({ kind: 'policy', args: { kind: 'rule', wording } })),
    '2027-01-11',
  )
  const then = closes.get(three) ?? []
  assert.deepEqual(
    then.map((d) => [d.op, d.state, d.then.map((t) => [t.op, t.state, t.reason ?? ''])]),
    rules.map(() => ['motion:policy:adopt', 'settled', [['document:document:generate', 'settled', '']]]),
  )
  assert.equal(await adopted(), 'statutes@12')
  const day = await applies(`${three}/1`)
  for (const v of ['statutes@10', 'statutes@11', 'statutes@12']) {
    assert.deepEqual(await cites(v), [{ motion: three, day }], `${v} cites ${three}`)
  }
  for (const [version, base] of [['statutes@11', 'statutes@10'], ['statutes@12', 'statutes@11']]) {
    assert.equal((await one<{ base: string }>('SELECT base FROM document.adoption WHERE version = $1', [version])).base, base)
  }
  const third = await linesOf('statutes@12')
  for (const n of [1, 2, 3]) {
    assert.ok(third.includes(await says(`${three}/${n}`)), `statutes@12 reads ${three}/${n}`)
  }
})
