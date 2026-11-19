// A circle amended by motion, end to end on a seeded Lanterne. Through
// the handlers, the assembly's proposals to amend a circle are refused at
// the proposal, each naming the circle, the value read and the fix: a
// circle there is not, a term no amendment changes, a blank name, another
// circle's name, a procedure in force nowhere, a change that changes
// nothing, Web amending itself, and features, which no amendment changes.
// Features are arranged apart, under `arrange-features`: the assembly
// arranges the coop's layout at the root by motion, its close replacing
// it in order, under its groups, a group renamed keeping its id and every
// circle's choice of it, and its entry saying what it was; Web shows a
// group and hides a feature by its own motion, one row an action, and
// coordination shows one for Hiring, which holds no power over its own; an
// arrangement of a circle that is no root, Web's motion arranging the
// layout, Brand's showing Web's, a row of the root, of no group or
// feature or that changes nothing, and layouts naming no installed
// feature, a feature twice, a group blank or listed apart, a feature
// under none or what the coop has already are refused at the proposal.
// Yusuf, Web's lead, shows and hides Web's at once by his own write, and
// neither Léa, a member of Web, nor Yusuf over Brand's or over the
// layout may. The manager, granted the power over the root, has a
// malformed layout refused in the guard's words, and two arrangements at
// once each log the layout the other left. A close whose effect fails for
// a serialization failure after its verdict runs again whole, signed once
// and logged once. Then in every browser, light and
// dark, through the dev server: Camille opens Web's Settings tab, its
// name, purpose and procedure in force, each changed by a motion of the
// Assembly; she types Brand's name and presses Enter, and the
// dialog says the change needs a motion of the assembly, why her write
// changes nothing, and offers the motion, whose
// proposal the guard refuses there, before anything is proposed; she
// types a name of Web's own in the dialog and proposes it, every member
// consents, and on its deadline she closes it: its close renames Web,
// which the circle's page and the coop selector name by its new name.
// `SHOTS` names where its screenshots go. Run by `cella test e2e amend`.

// browsers: one at a time: each browser renames Web by the assembly's motion and moves the scope's clock to its deadline, which the others read
// covers: membership-motion motion

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import pg from 'pg'
import { vote } from '@cella/org-motion/api'
import { arrange, hide, show } from '@cella/org-circle/api'
import { carried, close, propose } from '@cella/org-graft-membership-motion/api'
import type { Deps, Done } from '@cella/org-db'
import { reader, sign } from './lanterne.ts'
import { eachBrowser, serve, signIn } from './browser.ts'
import { chosen } from './controls.ts'
import { reacting } from '../src/lib/server/slices.ts'

const su = new pg.Client()
let app: pg.Client | undefined

const shots = process.env.SHOTS ?? '/tmp/cella-amend-shots'
const camille = 'camille@lanterne.example'
const lea = 'lea@lanterne.example'
const yusuf = 'yusuf@lanterne.example'
const web = 'Work: project, task, timesheet, document, file, contact'
let today = '2026-11-09'

async function on(date: string) {
  today = date
  await su.query(`ALTER ROLE cella_app IN DATABASE ${su.escapeIdentifier(su.database ?? '')} SET cella.clock = '${date}'`)
  await app?.end()
  app = new pg.Client({ user: 'cella_app' })
  await app.connect()
}

const as = (actor: string): Deps => ({ db: reader(app as pg.Client, actor), actor, sign: sign(actor) })
const all = async <R>(sql: string, values: unknown[] = []) => (await su.query(sql, values)).rows as R[]
const one = async <R>(sql: string, values: unknown[] = []) => (await all<R>(sql, values))[0]
const reason = (out: { state: string; reason?: string }) => (out.state === 'refused' ? (out.reason ?? '') : '')
const settled = <T>(out: { state: string; value?: T; reason?: string }): T => {
  assert.equal(out.state, 'settled', reason(out))
  return out.value as T
}
const states = (out: Done[]) => out.map((d) => [d.op, d.state, d.reason ?? ''])

// A motion of `circle` amending a circle as `args` say, proposed by
// Camille, or its refusal.
const fortnight = () => new Date(Date.parse(`${today}T00:00:00Z`) + 14 * 86400000).toISOString().slice(0, 10)
const amending = (args: Record<string, string>, circle = 'ag') =>
  propose({ circle, title: 'Amend a circle', deadline: fortnight(), body: '', actions: [{ kind: 'amend-circle', args }] }, as(camille))

// A motion of `circle` carrying one action of `kind`, the coop's
// layout arranged unless named, proposed by `by`, a member of it, or
// its refusal.
const arranging = (args: Record<string, string>, circle: string, by: string, kind = 'arrange-features') =>
  propose({ circle, title: 'Arrange features', deadline: fortnight(), body: '', actions: [{ kind, args }] }, as(by))

// Every member on the motion's roll consents, and on its deadline
// `closer`, Camille unless named, closes it; what its close carried.
async function decided(motion: string, closer = camille) {
  for (const { member } of await all<{ member: string }>('SELECT member FROM motion.roll WHERE motion = $1', [motion])) {
    settled(await vote({ motion, member, stance: 'consent' }, as(member)))
  }
  const { deadline } = await one<{ deadline: string }>(`SELECT to_char(deadline, 'YYYY-MM-DD') AS deadline FROM motion.motion WHERE id = $1`, [motion])
  await on(deadline)
  settled(await close({ motion }, as(closer)))
  return carried(motion, as(closer))
}

before(async () => {
  await su.connect()
  await on(today)
})

after(async () => {
  await app?.end()
  await su.end()
})

test('an amendment is refused at its proposal, naming the circle, the value read and the fix', async () => {
  const refused = async (args: Record<string, string>, circle?: string) => reason(await amending(args, circle))
  assert.match(await refused({ circle: 'nowhere', name: 'Somewhere' }), /no circle nowhere: a motion amends a circle there is, by its id/)
  assert.match(await refused({ circle: 'web', id: 'webby' }), /an amendment of web changes its name, its purpose or its procedure, not its id/)
  assert.match(await refused({ circle: 'web' }), /the amendment of web gives no new name, purpose or procedure: give at least one/)
  assert.match(await refused({ circle: 'web', name: '  ' }), /the amendment of web gives it a blank name: give it a name/)
  assert.match(await refused({ circle: 'web', name: ' brand ' }), /brand is named Brand already: give web a name no other circle has/)
  assert.match(
    await refused({ circle: 'web', procedure: 'unanimity' }),
    /unanimity is no procedure in force on 2026-11-09: give web one of consent, election, extraordinary, majority, ordinary, two-thirds/,
  )
  assert.match(await refused({ circle: 'web', name: 'Web', procedure: 'consent' }), /the amendment of web changes nothing: it is named Web, for .*, deciding by consent already; give a term it does not have/)
  assert.match(await refused({ circle: 'web', name: 'Studio' }, 'web'), /web may not decide about web: put its amendment to the assembly, or to another circle holding amend-circle/)
  assert.match(
    await refused({ circle: 'web', features: 'project, task' }),
    /an amendment of web changes its name, its purpose or its procedure, not its features: arrange them by an arrange-features action/,
  )
  assert.equal((await one<{ n: number }>(`SELECT count(*)::int AS n FROM motion.action WHERE kind = 'amend-circle'`)).n, 0, 'nothing was proposed')
})

test('the assembly changes Web\'s procedure and purpose by motion, its close amending it and its entry saying what each was', async () => {
  const { motion } = settled(await amending({ circle: 'web', purpose: 'the studio\'s websites', procedure: 'majority' })) as { motion: string }
  const out = await decided(motion)
  assert.deepEqual(states(out), [['circle:circle:amend', 'settled', '']])
  assert.deepEqual(await one(`SELECT name, purpose, procedure FROM circle.circle WHERE id = 'web'`), { name: 'Web', purpose: 'the studio\'s websites', procedure: 'majority' })
  const entry = await one<{ p: Record<string, unknown> }>(`SELECT cella.opened($1) AS p`, [out[0].entry])
  assert.equal(entry.p.circle, 'web')
  assert.equal(entry.p.procedure, 'majority')
  assert.equal((entry.p.was as Record<string, string>).procedure, 'consent', 'its entry says what the procedure was')
  const back = settled(await amending({ circle: 'web', procedure: 'consent' })) as { motion: string }
  assert.deepEqual(states(await decided(back.motion)), [['circle:circle:amend', 'settled', '']])
})

test('an arrangement is refused at its proposal where it is no root\'s, its circle holds arrange-features over no circle it arranges, or the listing or row is unsound', async () => {
  const refused = async (kind: string, args: Record<string, string>, circle = 'ag', by = camille) => reason(await arranging(args, circle, by, kind))
  const layout = (await one<{ f: string }>(`SELECT circle.features('ag') AS f`)).f
  const moved = layout.replace('Work: project, ', 'Work: ').replace('Organization: ', 'Organization: project, ')
  assert.match(await refused('arrange-features', { circle: 'web', features: 'Work: project' }, 'web', lea), /web is no root: the coop's features are arranged at ag, and web shows groups of them and hides features in them/)
  assert.match(await refused('arrange-features', { circle: 'ag', features: moved }, 'web', lea), /web holds arrange-features by no mandate covering ag: put the arrangement to ag, which holds it over ag/)
  assert.match(await refused('arrange-features', { circle: 'ag', features: layout.replace('project', 'tasks') }), /tasks is no feature the coop has installed: give ag features of account, bill, circle, .*, task, timesheet, transaction/)
  assert.match(await refused('arrange-features', { circle: 'ag', features: `${layout}, project` }), /the features of ag name project twice: list each once/)
  assert.match(await refused('arrange-features', { circle: 'ag', features: layout.replace('Work:', ' :') }), /a group of ag's features has a blank name: name it/)
  assert.match(await refused('arrange-features', { circle: 'ag', features: layout.replace('Work: ', '') }), /the features of ag put project under no group: list it under one/)
  assert.match(await refused('arrange-features', { circle: 'ag', features: `${layout.replace('Work: project, ', 'Work: ')}; Work: project` }), /the features of ag list the Work group's apart: list them together/)
  assert.match(await refused('arrange-features', { circle: 'ag', features: layout.replaceAll(', ', ',') }), /the arrangement of ag changes nothing/)
  assert.match(await refused('show-group', { circle: 'web', group: 'payments', shown: 'yes' }, 'brand'), /brand holds arrange-features by no mandate covering web: put the arrangement to web/)
  assert.match(await refused('show-group', { circle: 'ag', group: 'work', shown: 'no' }), /ag is the root, which shows every feature of the coop's layout: arrange the layout instead/)
  assert.match(await refused('show-group', { circle: 'web', group: 'money', shown: 'yes' }), /no group money in the coop's layout: show one of organization, work, books, payments, membership/)
  assert.match(await refused('show-group', { circle: 'web', group: 'payments', shown: 'maybe' }), /say whether web shows payments: shown yes or no/)
  assert.match(await refused('show-group', { circle: 'web', group: 'work', shown: 'yes' }), /web shows work already: show or hide another group/)
  assert.match(await refused('hide-feature', { circle: 'web', feature: 'tasks', hidden: 'yes' }), /tasks is no feature of the coop's layout: hide one of motion, meeting/)
  assert.match(await refused('hide-feature', { circle: 'web', feature: 'project', hidden: 'no' }), /web does not hide project already: hide or show another feature/)
  const twice = async (actions: { kind: string; args: Record<string, string> }[], circle = 'web', by = lea) =>
    reason(await propose({ circle, title: 'Twice', deadline: fortnight(), body: '', actions }, as(by)))
  const payments = { kind: 'show-group', args: { circle: 'web', group: 'payments', shown: 'yes' } }
  assert.match(await twice([payments, payments]), /the motion sets whether web shows payments twice: carry it once/)
  assert.match(await twice([payments, { ...payments, args: { ...payments.args, shown: 'no' } }]), /sets whether web shows payments twice/, 'even each way')
  const project = { kind: 'hide-feature', args: { circle: 'web', feature: 'project', hidden: 'yes' } }
  assert.match(await twice([project, project]), /the motion sets whether web hides project twice/)
  const arranged = { kind: 'arrange-features', args: { circle: 'ag', features: moved } }
  assert.match(await twice([arranged, arranged], 'ag', camille), /the motion arranges the coop's features twice: carry it once/)
  assert.equal((await one<{ n: number }>(`SELECT count(*)::int AS n FROM motion.action WHERE kind IN ('arrange-features', 'show-group', 'hide-feature')`)).n, 0, 'nothing was proposed')
})

test('the assembly arranges the coop\'s layout by motion, a group renamed keeping its id and every circle\'s choice of it, and its entry carrying the ids and the layout it replaced', async () => {
  const was = (await one<{ f: string }>(`SELECT circle.features('ag') AS f`)).f
  const features = was.replace('Work:', 'Studio:').replace(', contact;', ';').replace('Membership: ', 'Membership: contact, ')
  const { motion } = settled(await arranging({ circle: 'ag', features }, 'ag', camille)) as { motion: string }
  const out = await decided(motion)
  assert.deepEqual(states(out), [['circle:circle:arrange', 'settled', '']])
  assert.equal((await one<{ f: string }>(`SELECT circle.features('ag') AS f`)).f, features)
  assert.deepEqual(await all(`SELECT id, name FROM circle.feature_group ORDER BY position`), [
    { id: 'organization', name: 'Organization' },
    { id: 'work', name: 'Studio' },
    { id: 'books', name: 'Books' },
    { id: 'payments', name: 'Payments' },
    { id: 'membership', name: 'Membership' },
  ])
  const entry = await one<{ p: Record<string, unknown> }>(`SELECT cella.opened($1) AS p`, [out[0].entry])
  assert.equal(entry.p.features, features)
  assert.deepEqual(entry.p.groups, ['organization', 'work', 'books', 'payments', 'membership'])
  assert.equal(entry.p.was, was, 'its entry says what the layout was')
  assert.equal((await one<{ f: string }>(`SELECT circle.features('web') AS f`)).f, 'Studio: project, task, timesheet, document, file', 'Web still shows the renamed group, and Contact moved to Membership, which it does not show')
  assert.equal((await one<{ f: string }>(`SELECT circle.features('operations') AS f`)).f.startsWith('Studio: document; Books:'), true, 'Operations keeps Document in the renamed group and shows Contact in Membership now, where it shows Membership')
  assert.match((await one<{ f: string }>(`SELECT circle.features('operations') AS f`)).f, /Membership: contact, employment$/)
  const back = settled(await arranging({ circle: 'ag', features: was }, 'ag', camille)) as { motion: string }
  assert.deepEqual(states(await decided(back.motion)), [['circle:circle:arrange', 'settled', '']])
  assert.equal((await one<{ f: string }>(`SELECT circle.features('web') AS f`)).f, web)
})

test('Web shows a group and hides a feature by its own motion, one row an action; coordination does so for Hiring, which holds no power over its own', async () => {
  assert.equal((await one<{ d: string }>(`SELECT circle.arranger('hiring', cella.verdict_date()) AS d`)).d, 'coordination')
  assert.equal((await one<{ d: string }>(`SELECT circle.arranger('web', cella.verdict_date()) AS d`)).d, 'web', 'a circle holding it over itself arranges its own')
  const rows: { kind: string; args: Record<string, string> }[] = [
    { kind: 'show-group', args: { circle: 'web', group: 'payments', shown: 'yes' } },
    { kind: 'hide-feature', args: { circle: 'web', feature: 'payslip', hidden: 'yes' } },
  ]
  const { motion } = settled(await propose({ circle: 'web', title: 'Show Payments in Web', deadline: fortnight(), body: '', actions: rows }, as(lea))) as { motion: string }
  const out = await decided(motion, lea)
  assert.deepEqual(states(out), [['circle:circle:show', 'settled', ''], ['circle:circle:hide', 'settled', '']])
  assert.equal((await one<{ f: string }>(`SELECT circle.features('web') AS f`)).f, `Work: ${web.slice('Work: '.length)}; Payments: invoice, bill, expense`)
  const entry = await one<{ p: Record<string, unknown> }>(`SELECT cella.opened($1) AS p`, [out[0].entry])
  assert.deepEqual({ ...entry.p, motion: undefined }, { circle: 'web', group: 'payments', shown: true, was: false, motion: undefined }, 'its entry carries the row and what it was')
  const back = settled(
    await propose({ circle: 'web', title: 'Hide Payments in Web', deadline: fortnight(), body: '', actions: [
      { kind: 'show-group', args: { circle: 'web', group: 'payments', shown: 'no' } },
      { kind: 'hide-feature', args: { circle: 'web', feature: 'payslip', hidden: 'no' } },
    ] }, as(lea)),
  ) as { motion: string }
  assert.deepEqual(states(await decided(back.motion, lea)), [['circle:circle:show', 'settled', ''], ['circle:circle:hide', 'settled', '']])
  assert.equal((await one<{ f: string }>(`SELECT circle.features('web') AS f`)).f, web)

  const was = (await one<{ f: string }>(`SELECT circle.features('hiring') AS f`)).f
  const hiring = settled(await arranging({ circle: 'hiring', group: 'books', shown: 'yes' }, 'coordination', camille, 'show-group')) as { motion: string }
  assert.deepEqual(states(await decided(hiring.motion)), [['circle:circle:show', 'settled', '']])
  assert.equal((await one<{ f: string }>(`SELECT circle.features('hiring') AS f`)).f.replace('Books: account, transaction, report, import; ', ''), was)
  const unshown = settled(await arranging({ circle: 'hiring', group: 'books', shown: 'no' }, 'coordination', camille, 'show-group')) as { motion: string }
  assert.deepEqual(states(await decided(unshown.motion)), [['circle:circle:show', 'settled', '']])
})

test('Yusuf, Web\'s lead, shows and hides Web\'s at once by his own write; Léa, a member, Yusuf over Brand\'s and over the coop\'s layout may not', async () => {
  settled(await show({ circle: 'web', group: 'books', shown: true }, as(yusuf)))
  settled(await hide({ circle: 'web', feature: 'import', hidden: true }, as(yusuf)))
  assert.equal((await one<{ f: string }>(`SELECT circle.features('web') AS f`)).f, `${web}; Books: account, transaction, report`)
  const { op } = await one<{ op: string }>(`SELECT op FROM cella.log ORDER BY n DESC LIMIT 1`)
  assert.equal(op, 'circle:feature:hide', 'no motion: his own write')
  assert.match(reason(await show({ circle: 'web', group: 'books', shown: false }, as(lea))), /the actor holds no mandate for arrange-features/)
  assert.match(reason(await show({ circle: 'brand', group: 'books', shown: true }, as(yusuf))), /arrange-features/)
  const layout = (await one<{ f: string }>(`SELECT circle.features('ag') AS f`)).f
  assert.match(reason(await arrange({ circle: 'ag', features: layout.replace('Work:', 'Studio:') }, as(yusuf))), /arrange-features/)
  assert.match(reason(await arrange({ circle: 'web', features: web }, as(yusuf))), /web is no root/)
  settled(await hide({ circle: 'web', feature: 'import', hidden: false }, as(yusuf)))
  settled(await show({ circle: 'web', group: 'books', shown: false }, as(yusuf)))
  assert.equal((await one<{ f: string }>(`SELECT circle.features('web') AS f`)).f, web)
})

// A worker: a connection of its own as `cella_app` and its backend's pid,
// and the deps of a write of `actor` on it, the shell's reactions among
// them, so a close carries its effects in its own transaction as the
// shell's does.
interface Worker {
  c: pg.Client
  pid: number
}
async function worker(): Promise<Worker> {
  const c = new pg.Client({ user: 'cella_app' })
  await c.connect()
  const { rows } = await c.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')
  return { c, pid: rows[0]!.pid }
}
const on_ = (w: Worker, actor: string): Deps => reacting({ db: reader(w.c, actor), actor, sign: sign(actor) })

// Waits, a few seconds at most, until the worker's write waits on a lock.
async function waiting(w: Worker) {
  for (let i = 0; i < 200; i++) {
    const { waits } = await one<{ waits: boolean }>(`SELECT coalesce((SELECT wait_event_type = 'Lock' FROM pg_stat_activity WHERE pid = $1), false) AS waits`, [w.pid])
    if (waits) {
      return
    }
    await new Promise((r) => setTimeout(r, 50))
  }
  throw new Error(`the write on backend ${w.pid} never waited on a lock`)
}

// A superuser's transaction holding a lock `sql` takes, until it is
// released, once.
async function gate(sql: string) {
  const g = new pg.Client()
  await g.connect()
  await g.query('BEGIN')
  await g.query(sql)
  let open = true
  return async () => {
    if (open) {
      open = false
      await g.query('COMMIT')
      await g.end()
    }
  }
}

// Two workers for `run`, every gate it opens released, then the workers
// ended, whatever it threw.
async function racing(run: (a: Worker, b: Worker, gated: (sql: string) => Promise<() => Promise<void>>) => Promise<void>) {
  const [a, b] = [await worker(), await worker()]
  const gates: (() => Promise<void>)[] = []
  try {
    await run(a, b, async (sql) => {
      const release = await gate(sql)
      gates.push(release)
      return release
    })
  } finally {
    for (const release of gates) {
      await release()
    }
    await a.c.end()
    await b.c.end()
  }
}

// Every member on the motion's roll consents, and the clock moves to its
// deadline, for it to be closed.
async function due(motion: string) {
  for (const { member } of await all<{ member: string }>('SELECT member FROM motion.roll WHERE motion = $1', [motion])) {
    settled(await vote({ motion, member, stance: 'consent' }, as(member)))
  }
  const { deadline } = await one<{ deadline: string }>(`SELECT to_char(deadline, 'YYYY-MM-DD') AS deadline FROM motion.motion WHERE id = $1`, [motion])
  await on(deadline)
}

test('the manager, granted arrange-features over the root, arranges the layout at once: a malformed listing is refused in the guard\'s words, and two arrangements gated on the root each log the layout the other left', async () => {
  const grant = settled(
    await propose({ circle: 'ag', title: 'The manager arranges the layout', deadline: fortnight(), body: '', actions: [
      { kind: 'policy', args: { kind: 'mandate', wording: 'The {role: manager} role holds {power: arrange-features}, to arrange the features of the {scope: ag} circle' } },
    ] }, as(camille)),
  ) as { motion: string }
  assert.deepEqual(states(await decided(grant.motion)).map((s) => s[1]), ['settled'])
  const layout = (await one<{ f: string }>(`SELECT circle.features('ag') AS f`)).f
  assert.match(reason(await arrange({ circle: 'ag', features: `${layout}, project` }, as(camille))), /the features of ag name project twice: list each once/)
  assert.match(reason(await arrange({ circle: 'ag', features: layout.replace('Work: ', '') }, as(camille))), /the features of ag put project under no group: list it under one/)
  assert.equal((await one<{ f: string }>(`SELECT circle.features('ag') AS f`)).f, layout, 'nothing was laid')

  // The root held, two arrangements start, each on its worker, and wait;
  // released, the second reads the layout the first left as its `was`.
  await racing(async (a, b, gated) => {
    const release = await gated(`SELECT id FROM circle.circle WHERE id = 'ag' FOR NO KEY UPDATE`)
    const first = arrange({ circle: 'ag', features: layout.replace('Membership:', 'Members:') }, on_(a, camille))
    await waiting(a)
    const second = arrange({ circle: 'ag', features: layout.replace('Books:', 'Ledger:') }, on_(b, camille))
    await waiting(b)
    await release()
    for (const out of await Promise.all([first, second])) {
      settled(out)
    }
  })
  const [later, earlier] = (await all<{ p: { features: string; was: string } }>(
    `SELECT cella.opened(n) AS p FROM cella.log WHERE op = 'circle:feature:arrange' ORDER BY n DESC LIMIT 2`,
  )).map((e) => e.p)
  assert.equal(earlier!.was, layout, 'the first replaced the layout as it was')
  assert.equal(later!.was, earlier!.features, 'the second replaced the layout the first left, not the one it read before the lock')
  assert.equal((await one<{ f: string }>(`SELECT circle.features('ag') AS f`)).f, later!.features)
  settled(await arrange({ circle: 'ag', features: layout }, as(camille)))
  assert.deepEqual(await all(`SELECT id FROM circle.feature_group ORDER BY position`), ['organization', 'work', 'books', 'payments', 'membership'].map((id) => ({ id })))
})

test('a close carrying a circle\'s row and a write of that circle at once, both waiting on the log\'s head, take the circle and the head in one order, and neither deadlocks', async () => {
  const layout = (await one<{ f: string }>(`SELECT circle.features('ag') AS f`)).f
  const shows = settled(
    await propose({ circle: 'web', title: 'Show Payments in Web', deadline: fortnight(), body: '', actions: [{ kind: 'show-group', args: { circle: 'web', group: 'payments', shown: 'yes' } }] }, as(lea)),
  ) as { motion: string }
  await due(shows.motion)
  // The head held: the close waits on it first, then Yusuf's own hide.
  await racing(async (a, b, gated) => {
    const release = await gated('SELECT n FROM cella.head FOR UPDATE')
    const closing = close({ motion: shows.motion }, on_(a, lea))
    await waiting(a)
    const hiding = hide({ circle: 'web', feature: 'contact', hidden: true }, on_(b, yusuf))
    await waiting(b)
    await release()
    const [closed, hid] = await Promise.all([closing, hiding])
    settled(closed)
    settled(hid)
  })
  assert.equal((await one<{ f: string }>(`SELECT circle.features('web') AS f`)).f, `${web.replace(', contact', '')}; Payments: invoice, bill, expense, payslip`)

  // The same for the root: a close carrying an arrangement, then the
  // manager's own, on workers reading the clock moved to its deadline.
  const arranges = settled(
    await propose({ circle: 'ag', title: 'Rename Books', deadline: fortnight(), body: '', actions: [{ kind: 'arrange-features', args: { circle: 'ag', features: layout.replace('Books:', 'Ledger:') } }] }, as(camille)),
  ) as { motion: string }
  await due(arranges.motion)
  await racing(async (a, b, gated) => {
    const release = await gated('SELECT n FROM cella.head FOR UPDATE')
    const closing = close({ motion: arranges.motion }, on_(a, camille))
    await waiting(a)
    const own = arrange({ circle: 'ag', features: layout.replace('Membership:', 'Members:') }, on_(b, camille))
    await waiting(b)
    await release()
    const [closed, mine] = await Promise.all([closing, own])
    settled(closed)
    assert.equal((settled(mine) as { was: string }).was, layout.replace('Books:', 'Ledger:'), 'the manager\'s replaced the layout the close left')
  })
  settled(await arrange({ circle: 'ag', features: layout }, as(camille)))
  settled(await hide({ circle: 'web', feature: 'contact', hidden: false }, as(yusuf)))
  settled(await show({ circle: 'web', group: 'payments', shown: false }, as(yusuf)))
  assert.equal((await one<{ f: string }>(`SELECT circle.features('web') AS f`)).f, web)
})

test('a close dropping a group of the layout while a write shows that group in a circle deadlocks, and settles by retry: the show refused for its group gone, or both landing, and the log folds', async () => {
  const layout = (await one<{ f: string }>(`SELECT circle.features('ag') AS f`)).f
  const dropped = layout.replace('; Payments: ', ', ')
  const drops = settled(
    await propose({ circle: 'ag', title: 'Payments into Books', deadline: fortnight(), body: '', actions: [{ kind: 'arrange-features', args: { circle: 'ag', features: dropped } }] }, as(camille)),
  ) as { motion: string }
  await due(drops.motion)
  const deadlocks = async () => {
    await su.query('SELECT pg_stat_clear_snapshot()')
    return Number((await one<{ d: string }>('SELECT deadlocks AS d FROM pg_stat_database WHERE datname = current_database()')).d)
  }
  const before = await deadlocks()
  // The head held: the close waits on it first, holding the root; then
  // Yusuf's show of Payments in Web takes the group's key and waits on the
  // head too. Released, the close's arrangement deletes the group, waiting
  // on that key, while the show waits on the head: a deadlock, which
  // Postgres breaks by rolling one back, and the write layer runs it again.
  await racing(async (a, b, gated) => {
    const release = await gated('SELECT n FROM cella.head FOR UPDATE')
    const closing = close({ motion: drops.motion }, on_(a, camille))
    await waiting(a)
    const showing = show({ circle: 'web', group: 'payments', shown: true }, on_(b, yusuf))
    await waiting(b)
    await release()
    const [closed, shown] = await Promise.all([closing, showing])
    settled(closed)
    if (shown.state === 'refused') {
      assert.match(shown.reason ?? '', /no group payments in the coop's layout/, 'the show is refused for its group gone')
    } else {
      assert.equal(shown.state, 'settled')
    }
  })
  let after = await deadlocks()
  for (let i = 0; i < 40 && after === before; i++) {
    await new Promise((r) => setTimeout(r, 50))
    after = await deadlocks()
  }
  assert.ok(after > before, 'Postgres found the deadlock, and the retry settled it')
  assert.equal((await one<{ f: string }>(`SELECT circle.features('ag') AS f`)).f, dropped, 'the close dropped Payments')
  assert.deepEqual(await all(`SELECT "group" FROM circle.shown WHERE "group" = 'payments'`), [], 'and every circle\'s showing of it')
  assert.equal((await one<{ f: string }>(`SELECT circle.features('web') AS f`)).f, web)
  settled(await arrange({ circle: 'ag', features: layout }, as(camille)))
  assert.deepEqual(await all(`SELECT id FROM circle.feature_group ORDER BY position`), ['organization', 'work', 'books', 'payments', 'membership'].map((id) => ({ id })))
})

test('a motion carrying a row that is so by its close still passes, its action forgone, and the log folds', async () => {
  const { motion } = settled(
    await propose({ circle: 'web', title: 'Show Payments in Web', deadline: fortnight(), body: '', actions: [{ kind: 'show-group', args: { circle: 'web', group: 'payments', shown: 'yes' } }] }, as(lea)),
  ) as { motion: string }
  await due(motion)
  settled(await show({ circle: 'web', group: 'payments', shown: true }, as(yusuf)))
  const before = Number((await one<{ n: string }>('SELECT n FROM cella.head')).n)
  settled(await close({ motion }, reacting(as(lea))))
  assert.deepEqual(
    (await all<{ op: string; settled: boolean }>('SELECT op, settled FROM cella.log WHERE n > $1 ORDER BY n', [before])).map((e) => [e.op, e.settled]),
    [['motion:motion:close', true], ['circle:circle:show', false]],
    'the close stands, forgoing a show Web already has',
  )
  settled(await show({ circle: 'web', group: 'payments', shown: false }, as(yusuf)))
})


test('a close whose effect fails for a serialization failure after its verdict runs again whole: signed once, logged once, and its connection left writing nothing', async () => {
  const { motion } = settled(
    await propose({ circle: 'web', title: 'Show Payments in Web', deadline: fortnight(), body: '', actions: [{ kind: 'show-group', args: { circle: 'web', group: 'payments', shown: 'yes' } }] }, as(lea)),
  ) as { motion: string }
  await due(motion)
  // The first write of a showing fails as a serialization failure, after
  // the close's submit, inside its effect; a sequence counts the tries,
  // each statement writing one, as nothing a rolled-back attempt wrote
  // outlasts it.
  await su.query(`
    CREATE SEQUENCE public.retry_tries;
    CREATE FUNCTION public.retry_once() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $f$
    BEGIN
      IF nextval('public.retry_tries') = 1 THEN
        RAISE EXCEPTION 'a serialization failure, once' USING ERRCODE = 'serialization_failure';
      END IF;
      RETURN NULL;
    END
    $f$;
    CREATE TRIGGER retry_once BEFORE INSERT OR UPDATE OR DELETE ON circle.shown FOR EACH STATEMENT EXECUTE FUNCTION public.retry_once();`)
  try {
    const deps = reacting(as(lea))
    let signs = 0
    const before = Number((await one<{ n: string }>('SELECT n FROM cella.head')).n)
    settled(await close({ motion }, { ...deps, sign: (op, request) => (signs++, deps.sign(op, request)) }))
    assert.equal(signs, 1, 'the close is signed once, before its tries')
    assert.ok(Number((await one<{ n: string }>('SELECT last_value AS n FROM public.retry_tries')).n) > 1, 'it failed once, then ran again')
    assert.deepEqual(
      (await all<{ op: string; settled: boolean; cause: string | null }>('SELECT op, settled, cause FROM cella.log WHERE n > $1 ORDER BY n', [before])).map((e) => [e.op, e.settled, e.cause === null]),
      [['motion:motion:close', true, true], ['circle:circle:show', true, false]],
      'the try that failed left nothing in the log: one close, and the show it caused',
    )
    assert.deepEqual(await all(`SELECT "group" FROM circle.shown WHERE circle = 'web' AND "group" = 'payments'`), [{ group: 'payments' }])
    assert.deepEqual(
      // Its actor is the test reader's, set for the session; a server's
      // borrow (`lending`) sets it for the transaction alone.
      (await (app as pg.Client).query(`SELECT coalesce(current_setting('cella.writing', true), '') AS writing`)).rows,
      [{ writing: '' }],
      'the connection is left writing nothing',
    )
  } finally {
    await su.query('DROP TRIGGER retry_once ON circle.shown; DROP FUNCTION public.retry_once(); DROP SEQUENCE public.retry_tries')
  }
  settled(await show({ circle: 'web', group: 'payments', shown: false }, as(yusuf)))
})
eachBrowser((name, launch) => {
  test(`${name}: Camille renames Web from its Settings tab by the assembly's motion, and its page and the coop selector name it so, light and dark`, async () => {
    mkdirSync(shots, { recursive: true })
    const browser = await launch()
    try {
      for (const scheme of ['light', 'dark'] as const) {
        const at = `${name}, ${scheme}`
        const was = (await one<{ name: string }>(`SELECT name FROM circle.circle WHERE id = 'web'`)).name
        const renamed = `Web studio ${name} ${scheme}`
        const dev = await serve()
        const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: scheme, extraHTTPHeaders: { 'x-forwarded-proto': 'http' } })
        try {
          await signIn(context, dev.base, camille)
          const page = await context.newPage()
          const errors: string[] = []
          page.on('pageerror', (e) => errors.push(e.message))
          await page.goto(`${dev.base}/circles/web`)
          await page.waitForLoadState('networkidle')
          await page.getByRole('navigation', { name: 'Circle tabs' }).getByRole('link', { name: 'Settings' }).click()
          await page.waitForURL(`${dev.base}/circles/web?tab=settings`)
          await page.waitForLoadState('networkidle')

          const form = page.locator('form.settings').first()
          assert.equal(await form.getByLabel('Name').inputValue(), was, `${at}: its name in force`)
          assert.equal(await chosen(form.getByLabel('Decides by')), 'consent', `${at}: its procedure in force`)
          assert.equal(await form.getByRole('button', { name: 'Assembly changes this by motion' }).count(), 3, `${at}: each term wears the assembly's motion icon`)
          await page.screenshot({ path: `${shots}/amend-${name}-${scheme}.png`, fullPage: true })

          await form.getByLabel('Name').fill('Brand')
          await form.getByLabel('Name').press('Enter')
          const dialog = page.getByRole('dialog', { name: 'Assembly changes it by motion' })
          await dialog.waitFor()
          assert.ok(
            ((await dialog.textContent()) ?? '').includes(`${was}'s name, purpose and procedure change only by a motion of Assembly`),
            `${at}: the dialog says why her write changes nothing`,
          )
          assert.equal(await dialog.getByLabel('Title').inputValue(), `Rename ${was} to Brand`, `${at}: its title says the change`)
          assert.equal(await chosen(dialog.getByLabel('Circle')), 'ag',
 `${at}: put to the assembly`)
          await dialog.getByRole('button', { name: 'Propose to Assembly' }).click()
          await dialog.getByRole('alert').filter({ hasText: /brand is named Brand already: give web a name no other circle has/ }).waitFor()
          assert.equal((await one<{ n: number }>(`SELECT count(*)::int AS n FROM motion.action WHERE kind = 'amend-circle' AND args ->> 'name' = 'Brand'`)).n, 0, `${at}: refused before anything is proposed`)
          await page.screenshot({ path: `${shots}/amend-refused-${name}-${scheme}.png` })

          await dialog.getByLabel('New name').fill(renamed)
          await dialog.getByLabel('Title').fill(`Rename ${was} to ${renamed}`)
          await dialog.getByRole('button', { name: 'Propose to Assembly' }).click()
          await dialog.waitFor({ state: 'hidden' })
          const { motion } = await one<{ motion: string }>(`SELECT motion FROM motion.action WHERE kind = 'amend-circle' AND args ->> 'name' = $1`, [renamed])
          assert.deepEqual(
            await one(`SELECT d.circle, d.title, m.args FROM motion.motion d JOIN motion.action m ON m.motion = d.id WHERE d.id = $1`, [motion]),
            { circle: 'ag', title: `Rename ${was} to ${renamed}`, args: { circle: 'web', name: renamed } },
            `${at}: the assembly's motion renames Web`,
          )
          assert.deepEqual(states(await decided(motion)), [['circle:circle:amend', 'settled', '']], `${at}: its close renames Web`)

          await page.goto(`${dev.base}/circles/web`)
          await page.waitForLoadState('networkidle')
          assert.equal(await page.locator('h1.record').textContent().then((t) => t?.trim()), renamed, `${at}: the circle's page names it so`)
          // Seen through it, the selector names the circle as it is now.
          await page.getByRole('button', { name: 'View as this circle' }).click()
          await page.waitForLoadState('networkidle')
          assert.equal(await page.locator('.coop .name').textContent().then((t) => t?.trim()), renamed, `${at}: the coop selector names it so`)
          await page.screenshot({ path: `${shots}/amended-${name}-${scheme}.png` })
          assert.deepEqual(errors, [], `${at}: the page threw nothing`)
        } finally {
          await context.close()
          await dev.stop()
        }
      }
    } finally {
      await browser.close()
    }
  })
})
