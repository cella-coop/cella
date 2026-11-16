// A settings form that mixes the two kinds of setting, in every browser,
// light and dark, on the dev server's specimen (`/specimens/settings`):
// signed in as Camille, the form has no Save. Her name saves by its write
// as she presses Enter, and says it saved; a value she leaves as it was
// posts nothing, and Escape takes an edit back. Coordination's name,
// refused her, opens the dialog as she leaves the field, saying a motion
// of the assembly makes the change, from what to what, its reason the
// guard's words and its form the New form prefilled. Cancelled, the field
// shows the name in force again; proposed, it posts the motion and the
// outcome shows. The specimen has no actions: each post is answered here,
// so nothing is written. `SHOTS` names where its screenshots go. Run by
// `cella test e2e settings`.
// covers: core

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import { parse, stringify } from 'devalue'
import type { Page } from 'playwright-core'
import { eachBrowser, serve, signIn } from './browser.ts'
import { chosen } from './controls.ts'

const shots = process.env.SHOTS ?? '/tmp/cella-settings-shots'
const refusal = 'camille@lanterne.example holds no amend-circle in coordination: only a motion of Assembly renames it'

// Answers the specimen's sends as a settings page's would, each settled
// with a log entry of its own, and keeps what each carried, by write.
function answer(page: Page) {
  const posted: { action: string; fields: Record<string, string> }[] = []
  let entry = 900
  return {
    posted,
    ready: page.route('**/_app/remote/*/send', async (route) => {
      const { payload } = JSON.parse(route.request().postData() ?? '{}') as { payload: string }
      const sent = parse(Buffer.from(payload, 'base64url').toString()) as { write: string; fields: [string, string][] }
      posted.push({ action: sent.write, fields: Object.fromEntries(sent.fields) })
      const op = sent.write === 'propose' ? 'motion:motion:propose' : 'person:person:profile'
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ type: 'result', data: stringify({ _: { done: { op, state: 'settled', entry: ++entry, then: [] }, status: 200 } }) }),
      })
    }),
  }
}

eachBrowser((name, launch) => {
  test(`${name}: a mixed settings form saves the one kind as it changes and proposes the motion for the other, light and dark`, async () => {
    mkdirSync(shots, { recursive: true })
    const { base, stop } = await serve()
    const browser = await launch()
    try {
      for (const scheme of ['light', 'dark'] as const) {
        const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: scheme, extraHTTPHeaders: { 'x-forwarded-proto': 'http' } })
        await signIn(context, base, 'camille@lanterne.example')
        const page = await context.newPage()
        const errors: string[] = []
        page.on('pageerror', (e) => errors.push(e.message))
        const posts = answer(page)
        await posts.ready
        await page.goto(`${base}/specimens/settings`)
        await page.waitForLoadState('networkidle')
        const at = `${name}, ${scheme}`

        const form = page.locator('form.settings')
        assert.match((await form.textContent()) ?? '', /You change it here.*Assembly changes it by motion/s, `${at}: each setting says what changes it`)
        assert.equal(await form.getByRole('button').count(), 0, `${at}: the form has no Save`)
        const own = form.getByLabel('Your name')
        await own.fill('Camille Martin')
        await own.press('Enter')
        await own.fill('Camille Martin-Roy')
        await own.press('Escape')
        assert.equal(await own.inputValue(), 'Camille Martin', `${at}: Escape takes the edit back`)
        await own.fill('Camille Martin-Roy')
        await own.press('Enter')
        await form.getByText('Saved', { exact: true }).waitFor()
        await own.blur()
        assert.deepEqual(posts.posted, [{ action: 'profile', fields: { name: 'Camille Martin-Roy' } }], `${at}: the name posts once, by its write, and an unchanged one never`)

        const circle = form.getByLabel('Circle name')
        await circle.fill('Operations')
        await circle.press('Tab')
        const dialog = page.getByRole('dialog', { name: 'Assembly changes it by motion' })
        await dialog.waitFor()
        assert.equal(posts.posted.length, 1, `${at}: the circle's name posts no write`)
        assert.match((await dialog.locator('.change').textContent()) ?? '', /Circle name\s*Coordination\s*→\s*to\s*Operations/, `${at}: the dialog shows the change`)
        assert.equal((await dialog.locator('.why').textContent())?.trim(), refusal, `${at}: the reason is the guard's words`)
        assert.equal(await dialog.getByLabel('Title').inputValue(), 'Rename Coordination to Operations')
        assert.equal(await chosen(dialog.getByLabel('Circle')), 'ag')

        assert.equal(await dialog.getByLabel('Deadline').inputValue(), '23/11/2026')
        assert.equal(await dialog.getByLabel('New name').inputValue(), 'Operations')
        await page.screenshot({ path: `${shots}/settings-dialog-${name}-${scheme}.png` })

        await dialog.getByRole('button', { name: 'Cancel' }).click()
        await dialog.waitFor({ state: 'hidden' })
        assert.equal(await circle.inputValue(), 'Coordination', `${at}: cancelled, the field shows the name in force`)
        assert.equal(posts.posted.length, 1, `${at}: and nothing posts`)

        await circle.fill('Operations')
        await circle.press('Enter')
        await dialog.waitFor()
        assert.equal(await dialog.getByLabel('New name').inputValue(), 'Operations', `${at}: opened again, the dialog offers the change typed`)
        await dialog.getByRole('button', { name: 'Propose to Assembly' }).click()
        await dialog.waitFor({ state: 'hidden' })
        const proposed = posts.posted[1]
        assert.equal(proposed?.action, 'propose')
        assert.deepEqual(
          { ...proposed.fields, body: undefined },
          { title: 'Rename Coordination to Operations', circle: 'ag', deadline: '2026-11-23', kind: 'amend-circle', 'arg.circle': 'coordination', 'arg.name': 'Operations', body: undefined },
          `${at}: the motion posts as the New form would`,
        )
        await page.getByRole('status').filter({ hasText: 'Settled, log entry 902' }).waitFor()
        assert.equal(await circle.inputValue(), 'Coordination', `${at}: proposed, the change is the motion's to make`)
        await page.screenshot({ path: `${shots}/settings-proposed-${name}-${scheme}.png` })
        assert.deepEqual(errors, [], `${at}: the page threw nothing`)
        await context.close()
      }
    } finally {
      await browser.close()
      await stop()
    }
  })
})
