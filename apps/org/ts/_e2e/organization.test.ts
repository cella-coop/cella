// The organization scenario, in every browser, light and dark, on a
// seeded Lanterne through the dev server: Camille opens Settings from the
// co-op menu and lands on Organization, `/settings/organization`, first
// under Organization: the co-op's particulars in force, each changed by a
// motion of the General assembly, and under them the scope's address and
// timezone, each set by a host, and no Save button. She types a new seat
// and leaves it, and the dialog offers its motion; she closes it by
// Escape, the seat kept, marked not saved, types a SIREN of five
// digits and leaves it; the dialog says why no write of hers changes them and
// offers the assembly's motion, prefilled, each value its own field, whose
// proposal the guard refuses there before anything is proposed. She
// mends the SIREN in the dialog and proposes it: the assembly's motion
// carries one policy, the particulars worded again with the new seat,
// replacing those in force with their protection, and is decided by the
// extraordinary assembly. `SHOTS` names where its screenshots go. Run by
// `cella test e2e organization`.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import pg from 'pg'
import { eachBrowser, serve, signIn } from './browser.ts'

const shots = process.env.SHOTS ?? '/tmp/cella-organization-shots'
const camille = 'camille@lanterne.example'
const montreuil = '14 rue des Graviers, 93100 Montreuil, France'

eachBrowser((name, launch) => {
  test(`${name}: Camille changes the co-op's seat from Settings' Organization page, and leaving it proposes the assembly's motion, light and dark`, async () => {
    mkdirSync(shots, { recursive: true })
    const su = new pg.Client()
    await su.connect()
    const one = async <R>(sql: string, values: unknown[] = []) => (await su.query(sql, values)).rows[0] as R
    const { base, stop } = await serve()
    const browser = await launch()
    try {
      const { policy } = await one<{ policy: string }>('SELECT policy FROM circle.particulars() p')
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

          const form = page.locator('form.settings')
          assert.equal(await form.getByLabel('Name', { exact: true }).inputValue(), 'Lanterne', `${at}: its name in force`)
          assert.equal(await form.getByLabel('Seat').inputValue(), montreuil, `${at}: its seat in force`)
          assert.equal(await form.getByLabel('SIREN').inputValue(), '000000000', `${at}: its SIREN in force`)
          assert.equal(await form.getByText('A motion of General assembly changes it').count(), 8, `${at}: each particular is the assembly's motion's to change`)
          const scope = page.locator('section', { has: page.getByRole('heading', { name: 'Scope' }) })
          const hosted = (await scope.textContent()) ?? ''
          assert.match(hosted, /lanterne\.example/, `${at}: the scope's address`)
          assert.match(hosted, /Europe\/Paris/, `${at}: its timezone`)
          assert.equal(await scope.getByText('Set by a host').count(), 2, `${at}: each a host's to set`)
          await page.screenshot({ path: `${shots}/organization-${name}-${scheme}.png`, fullPage: true })
          await scope.screenshot({ path: `${shots}/organization-scope-${name}-${scheme}.png` })

          assert.equal(await page.getByRole('button', { name: /^Save/ }).count(), 0, `${at}: the page has no Save button`)
          await form.getByLabel('Seat').fill(seat)
          await form.getByLabel('Seat').press('Tab')
          const dialog = page.getByRole('dialog', { name: 'Propose it instead' })
          await dialog.waitFor()
          assert.equal(await dialog.getByLabel('Title').inputValue(), `Change the co-op's seat to ${seat}`, `${at}: leaving the seat offers its change alone`)
          await page.keyboard.press('Escape')
          await dialog.waitFor({ state: 'hidden' })
          const seated = form.locator('.setting', { has: page.getByLabel('Seat') })
          assert.equal(await form.getByLabel('Seat').inputValue(), seat, `${at}: closing keeps the seat typed`)
          assert.match((await seated.textContent()) ?? '', /Not saved/, `${at}: marked not saved`)
          await form.getByLabel('SIREN').fill('12345')
          await form.getByLabel('SIREN').press('Tab')
          await dialog.waitFor()
          assert.ok(
            ((await dialog.textContent()) ?? '').includes("The co-op's particulars change only by a motion of General assembly, which adopts them as a policy: no one's own write changes them"),
            `${at}: the dialog says why no write of hers changes them`,
          )
          assert.equal(await dialog.getByLabel('Title').inputValue(), `Change the co-op's seat to ${seat}; Change the co-op's SIREN to 12345`, `${at}: its title says the change`)
          assert.equal(await dialog.getByLabel('Circle').inputValue(), 'ag', `${at}: put to the assembly`)
          assert.equal(await dialog.getByLabel('New seat').inputValue(), seat, `${at}: the seat typed, its own field`)
          await dialog.getByRole('button', { name: 'Propose' }).click()
          await dialog.getByRole('alert').filter({ hasText: /a SIREN is nine digits, as \{particulars_siren: 123 456 789\}, not 12345/ }).waitFor()
          assert.equal(
            (await one<{ n: number }>(`SELECT count(*)::int AS n FROM motion.action WHERE kind = 'policy' AND args ->> 'wording' LIKE $1`, [`%${seat}%`])).n,
            0,
            `${at}: refused before anything is proposed`,
          )
          await page.screenshot({ path: `${shots}/organization-refused-${name}-${scheme}.png` })

          await dialog.getByLabel('New SIREN').fill('000000000')
          await dialog.getByLabel('Title').fill(`Move the seat to ${seat}`)
          await dialog.getByRole('button', { name: 'Propose' }).click()
          await dialog.waitFor({ state: 'hidden' })
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
            `The co-op is called {particulars_name: Lanterne}, its legal name {particulars_legal_name: Lanterne Worker Co-operative Limited Company}, a {particulars_form: Worker co-operative limited company with variable capital}, whose seat is {particulars_seat: ${seat}}, registered under SIREN {particulars_siren: 000000000} at the trade register of {particulars_rcs: Bobigny}, with the VAT number {particulars_vat: FR00000000000}`,
            `${at}: the particulars worded again, the seat typed and the rest as they stand`,
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
