// The organization scenario, in every browser, light and dark, on a
// seeded Lanterne through the dev server: Camille opens Settings from the
// coop menu and lands on Organization, `/settings/organization`, first
// under Organization: the coop's particulars in force, each changed by a
// motion of the Assembly, and under them the scope's address and
// timezone, each set by a host, said by an icon beside each label. The
// form has no Save. She types a SIREN of five digits and presses Enter:
// the change joins the changes to propose to the assembly, in the
// sidebar, the field showing the SIREN in force struck through; Review
// opens the motion, prefilled, whose proposal the guard refuses there
// before anything is proposed; she cancels, takes the SIREN out, and the
// SIREN in force shows again. She types a new seat and leaves the field,
// reviews and proposes the one motion: it carries one policy, the
// particulars worded again with the new seat, replacing those in force
// with their protection, and is decided by the extraordinary assembly. `SHOTS` names where its
// screenshots go. Run by `cella test e2e organization`.
// covers: motion

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import pg from 'pg'
import { eachBrowser, serve, signIn } from './browser.ts'
import { basket, chosen, review } from './controls.ts'

const shots = process.env.SHOTS ?? '/tmp/cella-organization-shots'
const camille = 'camille@lanterne.example'
const montreuil = '14 rue des Graviers, 93100 Montreuil, France'

eachBrowser((name, launch) => {
  test(`${name}: Camille changes the coop's seat from Settings' Organization page, and proposes the assembly's motion from the changes to propose, light and dark`, async () => {
    mkdirSync(shots, { recursive: true })
    const su = new pg.Client()
    await su.connect()
    const one = async <R>(sql: string, values: unknown[] = []) => (await su.query(sql, values)).rows[0] as R
    const { base, stop } = await serve()
    const browser = await launch()
    try {
      const { policy, logo } = await one<{ policy: string; logo: string }>('SELECT policy, logo FROM circle.particulars() p')
      for (const scheme of ['light', 'dark'] as const) {
        const at = `${name}, ${scheme}`
        const seat = `${scheme === 'light' ? 3 : 5} avenue Gambetta, 75020 Paris, France (${name})`
        const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: scheme, extraHTTPHeaders: { 'x-forwarded-proto': 'http' } })
        try {
          await signIn(context, base, camille)
          const page = await context.newPage()
          const errors: string[] = []
          page.on('pageerror', (e) => errors.push(e.message))
          await page.goto(`${base}/inbox`)
          await page.waitForLoadState('networkidle')

          await page.locator('.coop button.trigger').click()
          await page.getByRole('menuitem', { name: 'Settings' }).click()
          await page.waitForURL(`${base}/settings/organization`)
          await page.waitForLoadState('networkidle')
          const nav = page.getByRole('navigation', { name: 'Main' })
          assert.equal(await nav.locator('a[aria-current="page"]').textContent().then((t) => t?.trim()), 'Organization', `${at}: the sidebar marks it`)
          assert.equal(await nav.locator('p.heading').textContent().then((t) => t?.trim()), 'Settings', `${at}: Settings stands apart as the sidebar's own heading`)
          assert.deepEqual(
            (await nav.locator('p.group', { hasText: 'Organization' }).locator('xpath=following-sibling::ul[1]').locator('a').allTextContents()).map((t) => t.trim()),
            ['Organization', 'Features', 'Imports'],
            `${at}: Organization lists Features before Imports`,
          )

          const form = page.locator('form.settings')
          assert.equal(await form.getByLabel('Name', { exact: true }).inputValue(), 'Lanterne', `${at}: its name in force`)
          assert.equal(await form.getByLabel('Seat').inputValue(), montreuil, `${at}: its seat in force`)
          assert.equal(await form.getByLabel('SIREN').inputValue(), '000000000', `${at}: its SIREN in force`)
          assert.equal(await form.getByRole('button', { name: 'Assembly changes this by motion' }).count(), 8, `${at}: each particular wears the assembly's motion icon`)
          const scope = page.locator('section', { has: page.getByRole('heading', { name: 'Scope' }) })
          const hosted = (await scope.textContent()) ?? ''
          assert.match(hosted, /lanterne\.example/, `${at}: the scope's address`)
          assert.match(hosted, /Europe\/Paris/, `${at}: its timezone`)
          assert.equal(await scope.getByRole('button', { name: 'Set by a host' }).count(), 2, `${at}: each wears the host icon`)
          assert.equal(await scope.getByText('A host sets it, never a motion', { exact: false }).count(), 2, `${at}: whose tooltips say why`)
          await scope.getByRole('button', { name: 'Set by a host' }).first().focus()
          await page.getByRole('tooltip').filter({ hasText: 'every write the notary signs names it' }).waitFor()
          await page.screenshot({ path: `${shots}/organization-${name}-${scheme}.png`, fullPage: true })
          await scope.screenshot({ path: `${shots}/organization-scope-${name}-${scheme}.png` })

          assert.equal(await form.getByRole('button', { name: /Save/ }).count(), 0, `${at}: the form has no Save`)
          await form.getByLabel('SIREN').fill('12345')
          await form.getByLabel('SIREN').press('Enter')
          await basket(page, 'Assembly').waitFor()
          assert.equal(await page.getByRole('dialog').count(), 0, `${at}: no dialog opens for the one field`)
          assert.match((await basket(page, 'Assembly').textContent()) ?? '', /1 change to propose to Assembly.*SIREN.*000000000\s*→\s*12345/s, `${at}: the change waits in the sidebar`)
          assert.equal(await form.getByLabel('SIREN').inputValue(), '12345', `${at}: the field keeps the value typed`)
          assert.match((await form.locator('.was').textContent()) ?? '', /In force\s*000000000, proposed to Assembly/, `${at}: and shows the one in force struck through`)
          assert.equal(await form.getByRole('button', { name: 'Proposed to Assembly' }).count(), 1, `${at}: its icon says it is proposed`)
          const dialog = await review(page, 'Assembly')
          assert.match((await dialog.locator('figure.diff').textContent()) ?? '', /SIREN\s*000000000\s*to\s*12345/, `${at}: it shows the change`)
          assert.equal(await dialog.getByLabel('Title').inputValue(), "Change the coop's SIREN to 12345", `${at}: its title says the change`)
          assert.equal(await chosen(dialog.getByLabel('Circle')), 'ag',
 `${at}: put to the assembly`)
          assert.equal(await dialog.getByLabel('New SIREN').count(), 0, `${at}: the change is the diff, not a field`)
          await dialog.getByRole('button', { name: 'Propose it to Assembly' }).click()
          await dialog.getByRole('alert').filter({ hasText: /a SIREN is nine digits, as \{particulars_siren: 123 456 789\}, not 12345/ }).waitFor()
          assert.equal(
            (await one<{ n: number }>(`SELECT count(*)::int AS n FROM motion.action WHERE kind = 'policy' AND args ->> 'wording' LIKE $1`, ['%{particulars_siren: 12345}%'])).n,
            0,
            `${at}: refused before anything is proposed`,
          )
          await page.screenshot({ path: `${shots}/organization-refused-${name}-${scheme}.png` })
          await dialog.getByRole('button', { name: 'Cancel' }).click()
          await dialog.waitFor({ state: 'hidden' })
          assert.equal(await form.getByLabel('SIREN').inputValue(), '12345', `${at}: cancelled, the change still waits`)
          await basket(page, 'Assembly').getByRole('button', { name: 'Take SIREN out of the changes to propose' }).click()
          assert.equal(await form.getByLabel('SIREN').inputValue(), '000000000', `${at}: taken out, the SIREN in force shows again`)
          assert.equal(await page.getByRole('complementary', { name: 'Changes to propose' }).count(), 0, `${at}: and the sidebar holds nothing`)

          await form.getByLabel('Seat').fill(seat)
          await form.getByLabel('Seat').press('Tab')
          await review(page, 'Assembly')
          await dialog.getByLabel('Title').fill(`Move the seat to ${seat}`)
          await dialog.getByRole('button', { name: 'Propose it to Assembly' }).click()
          await dialog.waitFor({ state: 'hidden' })
          await page.getByRole('complementary', { name: 'Changes to propose' }).waitFor({ state: 'detached' })
          const { motion } = await one<{ motion: string }>(`SELECT motion FROM motion.action WHERE kind = 'policy' AND args ->> 'wording' LIKE $1`, [`%${seat}%`])
          const proposed = await one<{ circle: string; title: string; procedure: string; args: Record<string, string> }>(
            'SELECT d.circle, d.title, d.procedure, m.args FROM motion.motion d JOIN motion.action m ON m.motion = d.id WHERE d.id = $1',
            [motion],
          )
          assert.deepEqual(
            { ...proposed, args: { ...proposed.args, wording: undefined } },
            { circle: 'ag', title: `Move the seat to ${seat}`, procedure: 'extraordinary', args: { kind: 'rule', replaces: policy, protected: 'extraordinary', wording: undefined } },
            `${at}: the assembly's motion replaces the particulars in force, decided by the extraordinary assembly`,
          )
          assert.equal(
            proposed.args.wording,
            `The coop is called {particulars_name: Lanterne}, its legal name {particulars_legal_name: Lanterne Worker Co-operative Limited Company}, a {particulars_form: Worker co-operative limited company with variable capital}, whose seat is {particulars_seat: ${seat}}, registered under SIREN {particulars_siren: 000000000} at the trade register of {particulars_rcs: Bobigny}, with the VAT number {particulars_vat: FR00000000000}, and bears the mark {particulars_logo: ${logo}}`,
            `${at}: the particulars worded again, the seat typed and the rest as they stand, the logo among them`,
          )
          assert.equal((await one<{ seat: string }>('SELECT seat FROM circle.particulars()')).seat, montreuil, `${at}: nothing changes until the motion carries`)
          await page.screenshot({ path: `${shots}/organization-proposed-${name}-${scheme}.png`, fullPage: true })
          assert.deepEqual(errors, [], `${at}: the page threw nothing`)
        } finally {
          await context.close()
        }
      }
    } finally {
      await browser.close()
      await stop()
      await su.end()
    }
  })
})
