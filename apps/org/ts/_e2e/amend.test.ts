// A circle amended by motion, end to end on a seeded Lanterne. Through
// the handlers, the assembly's proposals to amend a circle are refused at
// the proposal, each naming the circle, the value read and the fix: a
// circle there is not, a term no amendment changes, a blank name, another
// circle's name, a procedure in force nowhere, a change that changes
// nothing, Web amending itself, and features, which no amendment changes.
// Features are arranged apart, under `arrange-features`: the assembly
// arranges the co-op's layout at the root by motion, its close replacing
// it in order, under its groups, a group renamed keeping its id and every
// circle's choice of it, and its entry saying what it was; Web shows a
// group and hides a feature by its own motion, one row an action, and
// coordination shows one for Hiring, which holds no power over its own; an
// arrangement of a circle that is no root, Web's motion arranging the
// layout, Brand's showing Web's, a row of the root, of no group or
// feature or that changes nothing, and layouts naming no installed
// feature, a feature twice, a group blank or listed apart, a feature
// under none or what the co-op has already are refused at the proposal.
// Yusuf, Web's lead, shows and hides Web's at once by his own write, and
// neither Léa, a member of Web, nor Yusuf over Brand's or over the
// layout may. Then in every browser, light and
// dark, through the dev server: Camille opens Web's Settings tab, its
// name, purpose and procedure in force, each changed by a motion of the
// Assembly; she types Brand's name and presses Enter, and the
// dialog says the change needs a motion of the assembly, why her write
// changes nothing, and offers the motion, whose
// proposal the guard refuses there, before anything is proposed; she
// types a name of Web's own in the dialog and proposes it, every member
// consents, and on its deadline she closes it: its close renames Web,
// which the circle's page and the co-op selector name by its new name.
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

const su = new pg.Client()
let app: pg.Client | undefined

const shots = process.env.SHOTS ?? '/tmp/cella-amend-shots'
const camille = 'camille@lanterne.example'
const lea = 'lea@lanterne.example'
const yusuf = 'yusuf@lanterne.example'
const web = 'Work: project, task, timesheet, file, contact'
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

// A motion of `circle` carrying one action of `kind`, the co-op's
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
  const moved = layout.replace('Work: project, ', 'Work: ').replace('Governance: ', 'Governance: project, ')
  assert.match(await refused('arrange-features', { circle: 'web', features: 'Work: project' }, 'web', lea), /web is no root: the co-op's features are arranged at ag, and web shows groups of them and hides features in them/)
  assert.match(await refused('arrange-features', { circle: 'ag', features: moved }, 'web', lea), /web holds arrange-features by no mandate covering ag: put the arrangement to ag, which holds it over ag/)
  assert.match(await refused('arrange-features', { circle: 'ag', features: layout.replace('project', 'tasks') }), /tasks is no feature the co-op has installed: give ag features of account, bill, circle, .*, task, timesheet, transaction/)
  assert.match(await refused('arrange-features', { circle: 'ag', features: `${layout}, project` }), /the features of ag name project twice: list each once/)
  assert.match(await refused('arrange-features', { circle: 'ag', features: layout.replace('Work:', ' :') }), /a group of ag's features has a blank name: name it/)
  assert.match(await refused('arrange-features', { circle: 'ag', features: layout.replace('Work: ', '') }), /the features of ag put project under no group: list it under one/)
  assert.match(await refused('arrange-features', { circle: 'ag', features: `${layout.replace('Work: project, ', 'Work: ')}; Work: project` }), /the features of ag list the Work group's apart: list them together/)
  assert.match(await refused('arrange-features', { circle: 'ag', features: layout.replaceAll(', ', ',') }), /the arrangement of ag changes nothing/)
  assert.match(await refused('show-group', { circle: 'web', group: 'payments', shown: 'yes' }, 'brand'), /brand holds arrange-features by no mandate covering web: put the arrangement to web/)
  assert.match(await refused('show-group', { circle: 'ag', group: 'work', shown: 'no' }), /ag is the root, which shows every feature of the co-op's layout: arrange the layout instead/)
  assert.match(await refused('show-group', { circle: 'web', group: 'money', shown: 'yes' }), /no group money in the co-op's layout: show one of governance, work, books, payments, members/)
  assert.match(await refused('show-group', { circle: 'web', group: 'payments', shown: 'maybe' }), /say whether web shows payments: shown yes or no/)
  assert.match(await refused('show-group', { circle: 'web', group: 'work', shown: 'yes' }), /web shows work already: show or hide another group/)
  assert.match(await refused('hide-feature', { circle: 'web', feature: 'tasks', hidden: 'yes' }), /tasks is no feature of the co-op's layout: hide one of motion, meeting/)
  assert.match(await refused('hide-feature', { circle: 'web', feature: 'project', hidden: 'no' }), /web does not hide project already: hide or show another feature/)
  assert.equal((await one<{ n: number }>(`SELECT count(*)::int AS n FROM motion.action WHERE kind IN ('arrange-features', 'show-group', 'hide-feature')`)).n, 0, 'nothing was proposed')
})

test('the assembly arranges the co-op\'s layout by motion, a group renamed keeping its id and every circle\'s choice of it, and its entry carrying the ids and the layout it replaced', async () => {
  const was = (await one<{ f: string }>(`SELECT circle.features('ag') AS f`)).f
  const features = was.replace('Work:', 'Studio:').replace(', contact;', ';').replace('Members: ', 'Members: contact, ')
  const { motion } = settled(await arranging({ circle: 'ag', features }, 'ag', camille)) as { motion: string }
  const out = await decided(motion)
  assert.deepEqual(states(out), [['circle:circle:arrange', 'settled', '']])
  assert.equal((await one<{ f: string }>(`SELECT circle.features('ag') AS f`)).f, features)
  assert.deepEqual(await all(`SELECT id, name FROM circle.feature_group ORDER BY position`), [
    { id: 'governance', name: 'Governance' },
    { id: 'work', name: 'Studio' },
    { id: 'books', name: 'Books' },
    { id: 'payments', name: 'Payments' },
    { id: 'members', name: 'Members' },
  ])
  const entry = await one<{ p: Record<string, unknown> }>(`SELECT cella.opened($1) AS p`, [out[0].entry])
  assert.equal(entry.p.features, features)
  assert.deepEqual(entry.p.groups, ['governance', 'work', 'books', 'payments', 'members'])
  assert.equal(entry.p.was, was, 'its entry says what the layout was')
  assert.equal((await one<{ f: string }>(`SELECT circle.features('web') AS f`)).f, 'Studio: project, task, timesheet, file', 'Web still shows the renamed group, and Contact moved to Members, which it does not show')
  assert.equal((await one<{ f: string }>(`SELECT circle.features('operations') AS f`)).f.startsWith('Books:'), true, 'Operations shows Contact in Members now, where it shows Members')
  assert.match((await one<{ f: string }>(`SELECT circle.features('operations') AS f`)).f, /Members: contact, employment$/)
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
  assert.deepEqual({ ...entry.p, motion: undefined }, { circle: 'web', group: 'payments', shown: true, motion: undefined })
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

test('Yusuf, Web\'s lead, shows and hides Web\'s at once by his own write; Léa, a member, Yusuf over Brand\'s and over the co-op\'s layout may not', async () => {
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

eachBrowser((name, launch) => {
  test(`${name}: Camille renames Web from its Settings tab by the assembly's motion, and its page and the co-op selector name it so, light and dark`, async () => {
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
          assert.equal(await page.locator('.coop .name').textContent().then((t) => t?.trim()), renamed, `${at}: the co-op selector names it so`)
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
