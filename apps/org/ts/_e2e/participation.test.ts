// The participation scenario, end to end on a seeded Lanterne, through the
// handlers and the built shell: Camille puts an amendment of the statutes
// to the assembly by its extraordinary procedure, two thirds of the votes
// cast once half take part, and it falls short of its quorum, then of its
// share, though more are for than against. On d-2026-011 she asks Malik,
// by name, what would win his consent, linking the rate card; the mention
// waits in his inbox until he answers, and the text stays out of the log.
// Each member's inbox holds what waits on them, counted in the sidebar;
// the home shows the co-op's figures from several collections; and Inès,
// employed and no member, logs her week in the grid, booking hours to a
// project where the log-time mandate refuses her. Run by
// `cella test e2e participation`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { procedures, propose, vote } from '@cella/org-decision/api'
import { terms } from '@cella/org-decision/models'
import { weeks } from '@cella/org-graft-project-timesheet-worker/api'
import { close } from '@cella/org-graft-circle-decision-member/api'
import { book } from '@cella/org-graft-project-timesheet/api'
import { submit } from '@cella/org-graft-timesheet-worker/api'
import type { Deps } from '@cella/org-db'
import { sign } from './lanterne.ts'
import { Shell } from './serve.ts'

const su = new pg.Client()
const shell = new Shell(su)
let app: pg.Client

const at = (name: string) => `${name}@lanterne.example`
const camille = at('camille')
const malik = at('malik')
const julien = at('julien')
const thomas = at('thomas')
const ines = at('ines')
const assembly = ['camille', 'yusuf', 'hugo', 'malik', 'julien', 'amina', 'thomas', 'lea', 'chloe', 'sofia'].map(at)

async function on(date: string) {
  await shell.start(date)
  await app?.end()
  app = new pg.Client({ user: 'cella_app' })
  await app.connect()
}

const as = (actor: string): Deps => ({ db: app, actor, sign: sign(actor) })
const all = async <R>(sql: string, values: unknown[] = []) => (await su.query(sql, values)).rows as R[]
const one = async <R>(sql: string, values: unknown[] = []) => (await all<R>(sql, values))[0]
const reason = (out: { state: string; reason?: string }) => (out.state === 'refused' || out.state === 'failed' ? (out.reason ?? '') : '')
const settled = <T>(out: { state: string; value?: T; reason?: string }): T => {
  assert.equal(out.state, 'settled', reason(out))
  return out.value as T
}
const passes = async (d: string) => (await one<{ p: boolean }>('SELECT circle_decision_member.passes($1) AS p', [d])).p
const turnout = async (d: string) => one('SELECT counted, given, quorate FROM circle_decision_member.turnout($1)', [d])
// A page as text, its tags gone.
const read = async (path: string, actor?: string) => {
  const { status, text } = await shell.page(path, actor)
  assert.equal(status, 200, path)
  return text.replace(/<[^>]+>/g, ' ').replace(/&#39;|&rsquo;|’/g, "'").replace(/\s+/g, ' ')
}

before(async () => {
  await su.connect()
  await on('2026-10-24')
})

after(async () => {
  await shell.stop()
  await app.end()
  await su.end()
})

test('Lanterne decides by consent, majority and two thirds, and by its statutes’ two assemblies', async () => {
  const rows = await all(`SELECT id, rule, share_num, share_den, quorum_num, quorum_den FROM decision.procedure ORDER BY id`)
  assert.deepEqual(rows, [
    { id: 'consent', rule: 'consent', share_num: null, share_den: null, quorum_num: 0, quorum_den: 1 },
    { id: 'extraordinary', rule: 'majority', share_num: 2, share_den: 3, quorum_num: 1, quorum_den: 2 },
    { id: 'majority', rule: 'majority', share_num: null, share_den: null, quorum_num: 0, quorum_den: 1 },
    { id: 'ordinary', rule: 'majority', share_num: null, share_den: null, quorum_num: 1, quorum_den: 4 },
    { id: 'two-thirds', rule: 'majority', share_num: 2, share_den: 3, quorum_num: 0, quorum_den: 1 },
  ])
  // The New form offers each in words.
  const offered = (await procedures(app)).map((p) => `${p.label}: ${terms(p)}`)
  assert.ok(offered.includes('Extraordinary assembly: majority of 2 in 3 of the votes cast, quorum 1 in 2'), offered.join('; '))
  assert.ok(offered.includes('Two thirds: majority of 2 in 3 of the votes cast'))
  const refused = await shell.act('/decisions', 'propose', { circle: 'ag', procedure: 'acclamation', title: 'Cheer', deadline: '2026-10-31', body: '' }, camille)
  assert.match(reason(refused), /a decision is taken by a procedure of the co-op’s, not “acclamation”/)
})

test('an amendment by the extraordinary assembly: short of its quorum, then of its two thirds, though more are for', async () => {
  const proposed = settled(
    await propose(
      { circle: 'ag', title: 'Amend the statutes: the work share paid in December', procedure: 'extraordinary', deadline: '2026-10-31', body: '', motions: [] },
      as(camille),
    ),
  )
  const d = proposed.decision
  assert.deepEqual(await one('SELECT rule, procedure FROM decision.decision WHERE id = $1', [d]), { rule: 'majority', procedure: 'extraordinary' })
  for (const member of assembly.slice(0, 4)) {
    settled(await vote({ decision: d, member, stance: 'for' }, as(member)))
  }
  assert.deepEqual(await turnout(d), { counted: 10, given: 4, quorate: false })
  assert.equal(await passes(d), false)
  assert.match(await read(`/decisions/${d}`, camille), /does not pass by extraordinary assembly, short of its quorum.*4 of 10, quorum 1 in 2/)
  for (const [member, stance] of [
    [assembly[4], 'for'],
    [assembly[5], 'for'],
    [assembly[6], 'against'],
    [assembly[7], 'against'],
    [assembly[8], 'against'],
  ] as const) {
    settled(await vote({ decision: d, member, stance }, as(member)))
  }
  // Six for and three against: at least two in three of the votes cast.
  assert.deepEqual(await turnout(d), { counted: 10, given: 9, quorate: true })
  assert.equal(await passes(d), true)
  settled(await vote({ decision: d, member: assembly[9], stance: 'against' }, as(assembly[9])))
  assert.equal(await passes(d), false)
  await on('2026-10-31')
  settled(await close({ decision: d }, as(camille)))
  assert.match(await read(`/decisions/${d}`, camille), /rejected by extraordinary assembly/)
  // The same stances carry a plain majority.
  assert.equal(
    (await one<{ p: boolean }>(`SELECT cella.majority(v.member, v.stance, v.receipt) AS p FROM decision.vote v WHERE v.decision = $1`, [d])).p,
    true,
  )
  await on('2026-10-24')
})

test('deliberation on d-2026-011: Camille asks Malik, linking the rate card, and he answers', async () => {
  const page = '/decisions/d-2026-011'
  const asked = await shell.act(
    page,
    'post',
    { body: '@malik what would it take for you to consent? The solidarity rate stays at 380 € in [[rate-card-2027@2]].', reply: '' },
    camille,
  )
  assert.equal(asked.state, 'settled', reason(asked))
  const message = await one<{ receipt: string; mentions: string[]; links: string[] }>(
    `SELECT receipt::text, mentions, links FROM decision.message WHERE decision = 'd-2026-011'`,
  )
  assert.deepEqual([message.mentions, message.links], [['malik'], ['rate-card-2027@2']])
  // The text is Camille's words: the log commits to the mentions and the
  // links, not to what she said.
  const logged = await one<{ payload: Record<string, unknown> }>('SELECT cella.opened($1) AS payload', [asked.entry])
  assert.deepEqual(Object.keys(logged.payload).sort(), ['decision', 'links', 'member', 'mentions', 'message', 'reply'])
  assert.ok(!JSON.stringify(logged.payload).includes('solidarity'))
  const discussion = await read(`${page}?tab=discussion`, malik)
  assert.match(discussion, /Camille Martin .*Malik Benali what would it take for you to consent\? .*Rate card 2027/)
  assert.ok((await shell.page('/inbox', malik)).text.includes('Camille Martin mentioned you on Raise the day rate for 2027'))
  const answer = await shell.act(page, 'post', { body: 'If the rate card says when the solidarity rate applies. @camille?', reply: message.receipt }, malik)
  assert.equal(answer.state, 'settled', reason(answer))
  assert.equal((await one<{ reply: string }>(`SELECT reply::text FROM decision.message WHERE member = $1`, [malik])).reply, message.receipt)
  assert.ok(!(await shell.page('/inbox', malik)).text.includes('mentioned you on Raise the day rate'))
  assert.ok((await shell.page('/inbox', camille)).text.includes('Malik Benali mentioned you on Raise the day rate for 2027'))
})

test('a message names members and documents there are, is posted by the circle’s members, and not once it closes', async () => {
  const post = (body: string, actor = camille, page = '/decisions/d-2026-011') => shell.act(page, 'post', { body, reply: '' }, actor)
  assert.match(reason(await post('Ask @nadia.')), /@nadia names no one member/)
  assert.match(reason(await post('See [[the-moon]].')), /\[\[the-moon\]\] names no document/)
  assert.match(reason(await post('From the web circle.', thomas)), /thomas@lanterne.example holds no seat in coordination, so may not post d-2026-011/)
  assert.match(reason(await post('Too late.', camille, '/decisions/d-2026-006')), /d-2026-006 is closed/)
})

test('each member’s inbox holds what waits on them, counted in the sidebar', async () => {
  // Malik: a stance on Inès's admission and the two meetings ahead; Julien,
  // in finance, three expenses to approve as well.
  const malik1 = (await shell.page('/inbox', malik)).text
  for (const what of ['Admit Inès Haddad as a member', 'Say whether you will come: Coordination', 'Say whether you will come: General assembly']) {
    assert.ok(malik1.includes(what), what)
  }
  const julien1 = (await shell.page('/inbox', julien)).text
  for (const what of ['Approve Print proofs for the press check', 'Approve Coffee and pastries, Nuvola workshop', 'Approve Display font licence']) {
    assert.ok(julien1.includes(what), what)
  }
  const count = (text: string) => Number(/aria-label="(\d+) waiting"/.exec(text)?.[1] ?? 0)
  const before = count(malik1)
  settled(await vote({ decision: 'd-2026-012', member: malik, stance: 'consent' }, as(malik)))
  const malik2 = (await shell.page('/inbox', malik)).text
  assert.ok(!malik2.includes('Admit Inès Haddad as a member'))
  assert.equal(count(malik2), before - 1)
  // Inès is invited: taking it up waits on her.
  assert.ok((await shell.page('/inbox', ines)).text.includes('Take up your invitation to join'))
  // A pay run prepared waits on whoever may approve it; a month
  // submitted, on whoever may approve its time.
  // A run prepared waits on the manager, who approves pay; a month
  // submitted by a worker who is no member, on finance, who approve time.
  await su.query(`INSERT INTO payslip.run (month, generated) VALUES ('2026-10', '2026-10-24')`)
  await on('2026-11-02')
  settled(await submit({ member: ines, month: '2026-10' }, as(ines)))
  assert.ok((await read('/inbox', camille)).includes('Approve the 2026-10 pay run'))
  assert.ok((await read('/inbox', julien)).includes("Approve 2026-10's time ines@lanterne.example"))
  await su.query(`DELETE FROM payslip.run WHERE month = '2026-10'`)
  await on('2026-10-24')
})

test('the home shows the co-op’s figures from several collections, and a viewer pins their own', async () => {
  const home = await read('/', camille)
  for (const title of ['Cash', 'Owed by clients', 'Overdue', 'Margin on projects', 'Open decisions', 'Meetings ahead', 'Invoiced by month', 'Projects by watch']) {
    assert.ok(home.includes(title), title)
  }
  const open = (await one<{ n: number }>(`SELECT count(*)::int AS n FROM decision.decision WHERE closed IS NULL`)).n
  assert.match(home, new RegExp(`Open decisions Decisions ${open} `))
  const own = [
    { collection: 'timesheets', kind: 'kpi', title: 'Hours logged', measure: { op: 'sum', field: 'hours' } },
    { collection: 'nowhere', kind: 'kpi', title: 'Lost', measure: { op: 'count' } },
    { collection: 'invoices', kind: 'kpi', title: 'Bad', measure: { op: 'sum', field: 'bill_to' } },
  ]
  const pinned = await read(`/?w=${encodeURIComponent(JSON.stringify(own))}`, camille)
  assert.match(pinned, /Hours logged Timesheets/)
  assert.match(pinned, /a widget on the home runs over no collection "nowhere"/)
  assert.match(pinned, /sum of bill_to, which is text, not a number/)
  assert.ok(!pinned.includes('Owed by clients'))
})

test('Inès logs her week in the grid, booking hours to a project where the mandate refuses her', async () => {
  // Behind the New button, her week from Monday the 19th, the co-op's own
  // time last, the days from her hire to today open.
  const [now, before] = await weeks(app, ines)
  assert.deepEqual([now.monday, before.monday], ['2026-10-19', '2026-10-12'])
  assert.equal(now.rows.at(-1)?.title, 'The co-op’s own time')
  assert.deepEqual(
    now.days.map((d) => d.open),
    [true, true, true, true, true, true, false],
  )
  assert.deepEqual(await weeks(app, 'nadia@lanterne.example'), [])
  // Booking through the mandate: Inès holds no seat, so no log-time.
  const mandate = await book({ member: ines, day: '2026-10-22', minutes: 120, billable: true, project: 'ferrand-packaging' }, as(ines))
  assert.equal(mandate.state, 'refused')
  const week: [string, string][] = [
    ['row', 'ferrand-packaging'],
    ['row', '_'],
    ['day', '2026-10-22'],
    ['day', '2026-10-23'],
    ['cell.ferrand-packaging.2026-10-22', '2'],
    ['cell._.2026-10-23', '1,5'],
  ]
  const logged = await shell.act('/timesheets', 'week', week, ines)
  assert.equal(logged.state, 'settled', reason(logged))
  assert.deepEqual(
    [logged.op, ...logged.then.map((t) => t.op)],
    ['timesheet-worker:entry:log', 'project-timesheet-worker:entry:book'],
  )
  const entries = await all(
    `SELECT to_char(e.day, 'YYYY-MM-DD') AS day, e.minutes, e.billable, b.project
     FROM timesheet.entry e LEFT JOIN project_timesheet.booking b ON b.entry = e.id
     WHERE e.member = $1 AND e.day IN ('2026-10-22', '2026-10-23') AND (b.project IS NOT NULL OR e.minutes = 90)
     ORDER BY e.day`,
    [ines],
  )
  assert.deepEqual(entries, [
    { day: '2026-10-22', minutes: 120, billable: true, project: 'ferrand-packaging' },
    { day: '2026-10-23', minutes: 90, billable: false, project: null },
  ])
  // A day to come takes nothing: the first refusal stops the week.
  const ahead = await shell.act(
    '/timesheets',
    'week',
    [
      ['row', 'ferrand-packaging'],
      ['day', '2026-10-26'],
      ['cell.ferrand-packaging.2026-10-26', '3'],
    ],
    ines,
  )
  assert.equal(ahead.state, 'refused')
  assert.match(reason(ahead), /2026-10-26/)
})
