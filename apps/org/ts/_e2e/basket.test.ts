// The basket scenario, in every browser, on a seeded Lanterne through the
// dev server: Camille changes the coop's seat on Settings' Organization
// page and turns Web's reactions off on Web's rules page, both decided by
// the assembly. Neither opens a dialog: each joins the changes to propose
// to the assembly, in the settings pages' sidebar, which counts two on
// the second page and still two after a reload. Review opens one dialog
// showing both changes as diffs, and Propose raises one motion of the
// assembly carrying both actions, the particulars adopted again with the
// new seat and Web's rule; the sidebar empties, and nothing changes until
// the motion carries. `SHOTS` names where its screenshots go. Run by
// `cella test e2e basket`.
// covers: membership-motion motion

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import pg from 'pg'
import { eachBrowser, serve, signIn } from './browser.ts'
import { basket, choose, chosen, review } from './controls.ts'

const shots = process.env.SHOTS ?? '/tmp/cella-basket-shots'
const camille = 'camille@lanterne.example'

eachBrowser((name, launch) => {
  test(`${name}: Camille gathers a change on two settings pages and proposes both as one motion of the assembly`, async () => {
    mkdirSync(shots, { recursive: true })
    const su = new pg.Client()
    await su.connect()
    const one = async <R>(sql: string, values: unknown[] = []) => (await su.query(sql, values)).rows[0] as R
    const all = async <R>(sql: string, values: unknown[] = []) => (await su.query(sql, values)).rows as R[]
    const { base, stop } = await serve()
    const browser = await launch()
    const seat = `9 rue de la Lanterne, 93100 Montreuil, France (${name})`
    try {
      const { policy, montreuil } = await one<{ policy: string; montreuil: string }>('SELECT policy, seat AS montreuil FROM circle.particulars() p')
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, extraHTTPHeaders: { 'x-forwarded-proto': 'http' } })
      try {
        await signIn(context, base, camille)
        const page = await context.newPage()
        const errors: string[] = []
        page.on('pageerror', (e) => errors.push(e.message))
        await page.goto(`${base}/settings/organization`)
        await page.waitForLoadState('networkidle')
        const sidebar = page.getByRole('complementary', { name: 'Changes to propose' })
        assert.equal(await sidebar.count(), 0, `${name}: nothing waits yet`)

        const form = page.locator('form.settings')
        await form.getByLabel('Seat').fill(seat)
        await form.getByLabel('Seat').press('Tab')
        await basket(page, 'Assembly').waitFor()
        assert.equal(await page.getByRole('dialog').count(), 0, `${name}: the seat opens no dialog`)

        await page.goto(`${base}/settings/rules/web`)
        await page.waitForLoadState('networkidle')
        assert.match((await basket(page, 'Assembly').textContent()) ?? '', /1 change to propose to Assembly/, `${name}: the change waits on another page`)
        await choose(page.locator('form.settings').getByLabel(/Reactions on comments/), 'off')
        await basket(page, 'Assembly').getByRole('heading', { name: '2 changes to propose to Assembly' }).waitFor()
        assert.equal(await page.getByRole('dialog').count(), 0, `${name}: nor does the rule`)
        assert.equal(await page.locator('form.settings').getByRole('button', { name: 'Proposed to Assembly' }).count(), 1, `${name}: the field wears the proposed icon`)

        await page.reload()
        await page.waitForLoadState('networkidle')
        await basket(page, 'Assembly').getByRole('heading', { name: '2 changes to propose to Assembly' }).waitFor()
        assert.equal(await chosen(page.locator('form.settings').getByLabel(/Reactions on comments/)), 'off', `${name}: after a reload the field shows the change waiting`)
        await page.screenshot({ path: `${shots}/basket-${name}.png`, fullPage: true })

        const dialog = await review(page, 'Assembly')
        const diffs = dialog.locator('figure.diff')
        assert.equal(await diffs.count(), 2, `${name}: one diff for each change`)
        assert.match((await diffs.nth(0).textContent()) ?? '', new RegExp(`The coop · Seat\\s*${montreuil.replace(/[()]/g, '\\$&')}\\s*to\\s*${seat.replace(/[()]/g, '\\$&')}`), `${name}: the seat, from the one in force`)
        assert.match((await diffs.nth(1).textContent()) ?? '', /Web · Reactions on comments.*On\s*to\s*Off/, `${name}: the rule, from on to off`)
        assert.equal(await chosen(dialog.getByLabel('Circle')), 'ag', `${name}: put to the assembly`)
        await page.screenshot({ path: `${shots}/basket-review-${name}.png` })
        await dialog.getByLabel('Title').fill(`Move the seat and quiet Web's comments (${name})`)
        await dialog.getByRole('button', { name: 'Propose all 2 to Assembly' }).click()
        await dialog.waitFor({ state: 'hidden' })
        await sidebar.waitFor({ state: 'detached' })

        const { motion } = await one<{ motion: string }>('SELECT id AS motion FROM motion.motion WHERE title = $1', [`Move the seat and quiet Web's comments (${name})`])
        const actions = await all<{ kind: string; args: Record<string, string> }>('SELECT kind, args FROM motion.action WHERE motion = $1 ORDER BY n', [motion])
        assert.equal(actions.length, 2, `${name}: one motion carries both changes`)
        assert.equal((await one<{ circle: string }>('SELECT circle FROM motion.motion WHERE id = $1', [motion])).circle, 'ag')
        assert.deepEqual([actions[0]!.kind, actions[0]!.args.kind, actions[0]!.args.replaces], ['policy', 'rule', policy], `${name}: the particulars adopted again`)
        assert.ok(actions[0]!.args.wording.includes(`{particulars_seat: ${seat}}`), `${name}: with the new seat`)
        assert.deepEqual([actions[1]!.kind, actions[1]!.args.wording], ['policy', 'Assembly sets {setting: reactions} to {value: off} for {circle: web}'], `${name}: and Web's rule`)
        assert.equal((await one<{ seat: string }>('SELECT seat FROM circle.particulars()')).seat, montreuil, `${name}: nothing changes until the motion carries`)
        assert.equal(await chosen(page.locator('form.settings').getByLabel(/Reactions on comments/)), 'on', `${name}: the field shows the value in force again`)
        assert.deepEqual(errors, [], `${name}: the page threw nothing`)
      } finally {
        await context.close()
      }
    } finally {
      await browser.close()
      await stop()
      await su.end()
    }
  })
})
