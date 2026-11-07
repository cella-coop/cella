// A circle amended by motion, end to end on a seeded Lanterne. Through
// the handlers, the assembly's proposals to amend a circle are refused at
// the proposal, each naming the circle, the value read and the fix: a
// circle there is not, a term no amendment changes, a blank name, another
// circle's name, a procedure in force nowhere, a change that changes
// nothing, and Web amending itself. Then in every browser, light and
// dark, through the dev server: Camille opens Web's Settings tab, its
// name, purpose and procedure in force, each changed by a motion of the
// General assembly; she types Brand's name and Saves, and the dialog
// says why her write changes nothing and offers the motion, whose
// proposal the guard refuses there, before anything is proposed; she
// types a name of Web's own in the dialog and proposes it, every member
// consents, and on its deadline she closes it: its close renames Web,
// which the circle's page and the co-op selector name by its new name.
// `SHOTS` names where its screenshots go. Run by `cella test e2e amend`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import pg from 'pg'
import { vote } from '@cella/org-motion/api'
import { carried, close, propose } from '@cella/org-graft-membership-motion/api'
import type { Deps, Done } from '@cella/org-db'
import { reader, sign } from './lanterne.ts'
import { browsers, serve, signIn } from './browser.ts'

const su = new pg.Client()
let app: pg.Client | undefined

const shots = process.env.SHOTS ?? '/tmp/cella-amend-shots'
const camille = 'camille@lanterne.example'
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

// Every member on the motion's roll consents, and on its deadline Camille
// closes it; what its close carried.
async function decided(motion: string) {
  for (const { member } of await all<{ member: string }>('SELECT member FROM motion.roll WHERE motion = $1', [motion])) {
    settled(await vote({ motion, member, stance: 'consent' }, as(member)))
  }
  const { deadline } = await one<{ deadline: string }>(`SELECT to_char(deadline, 'YYYY-MM-DD') AS deadline FROM motion.motion WHERE id = $1`, [motion])
  await on(deadline)
  settled(await close({ motion }, as(camille)))
  return carried(motion, as(camille))
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

for (const [name, launch] of browsers()) {
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
          assert.equal(await form.getByLabel('Decides by').inputValue(), 'consent', `${at}: its procedure in force`)
          assert.equal(await form.getByText('A motion of General assembly changes it').count(), 3, `${at}: each term is the assembly's motion's to change`)
          await page.screenshot({ path: `${shots}/amend-${name}-${scheme}.png`, fullPage: true })

          await form.getByLabel('Name').fill('Brand')
          await form.getByRole('button', { name: 'Save' }).click()
          const dialog = page.getByRole('dialog', { name: 'Propose it instead' })
          await dialog.waitFor()
          assert.ok(
            ((await dialog.textContent()) ?? '').includes(`${was}'s name, purpose and procedure change only by a motion of General assembly`),
            `${at}: the dialog says why her write changes nothing`,
          )
          assert.equal(await dialog.getByLabel('Title').inputValue(), `Rename ${was} to Brand`, `${at}: its title says the change`)
          assert.equal(await dialog.getByLabel('Circle').inputValue(), 'ag', `${at}: put to the assembly`)
          await dialog.getByRole('button', { name: 'Propose' }).click()
          await dialog.getByRole('alert').filter({ hasText: /brand is named Brand already: give web a name no other circle has/ }).waitFor()
          assert.equal((await one<{ n: number }>(`SELECT count(*)::int AS n FROM motion.action WHERE kind = 'amend-circle' AND args ->> 'name' = 'Brand'`)).n, 0, `${at}: refused before anything is proposed`)
          await page.screenshot({ path: `${shots}/amend-refused-${name}-${scheme}.png` })

          await dialog.getByLabel('New name').fill(renamed)
          await dialog.getByLabel('Title').fill(`Rename ${was} to ${renamed}`)
          await dialog.getByRole('button', { name: 'Propose' }).click()
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
          await page.locator('.coop button.trigger').click()
          const circles = page.getByRole('group', { name: 'Circles' })
          await circles.waitFor()
          assert.ok((await circles.getByRole('menuitemradio').allTextContents()).map((t) => t.trim()).includes(renamed), `${at}: the co-op selector names it so`)
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
}
