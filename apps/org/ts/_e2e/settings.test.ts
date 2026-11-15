// A settings form that mixes the two kinds of setting, in every browser,
// light and dark, on the dev server's specimen (`/specimens/settings`):
// signed in as Camille, with no Save button on the page. Her name, left,
// posts by its write alone and says it saved; emptied and left, its
// write is refused, and the reason stays under the field with the value
// typed, marked not saved. Coordination's name, refused her, left, opens
// the dialog proposing the motion instead, its reason the guard's words
// and its form the New form prefilled; Escape closes it, keeping what was
// typed, marked not saved, and as Enter left it, focus comes back to it
// and leaving it then offers nothing; come back to and left again, the
// dialog opens again, and
// proposed, it posts the motion and the outcome shows. The specimen has
// no actions: each post is answered here, so nothing is written. `SHOTS`
// names where its screenshots go. Run by `cella test e2e settings`.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import { parse, stringify } from 'devalue'
import type { Page } from 'playwright-core'
import { eachBrowser, serve, signIn } from './browser.ts'

const shots = process.env.SHOTS ?? '/tmp/cella-settings-shots'
const refusal = 'camille@lanterne.example holds no amend-circle in coordination: only a motion of General assembly renames it'

const emptied = 'a person is named by a name of one character or more: give the name they go by'

// Answers the specimen's sends as a settings page's would, each settled
// with a log entry of its own but a name emptied, which is refused, and
// keeps what each carried, by write.
function answer(page: Page) {
  const posted: { action: string; fields: Record<string, string> }[] = []
  let entry = 900
  return {
    posted,
    ready: page.route('**/_app/remote/*/send', async (route) => {
      const { payload } = JSON.parse(route.request().postData() ?? '{}') as { payload: string }
      const sent = parse(Buffer.from(payload, 'base64url').toString()) as { write: string; fields: [string, string][] }
      const fields = Object.fromEntries(sent.fields)
      posted.push({ action: sent.write, fields })
      const op = sent.write === 'propose' ? 'motion:motion:propose' : 'person:person:profile'
      const done =
        fields.name === '' ? { done: { op, state: 'refused', entry: ++entry, reason: emptied, then: [] }, status: 422 } : { done: { op, state: 'settled', entry: ++entry, then: [] }, status: 200 }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ type: 'result', data: stringify({ _: done }) }) })
    }),
  }
}

eachBrowser((name, launch) => {
  test(`${name}: a mixed settings form saves each field as it is left and proposes the motion for one refused, light and dark`, async () => {
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
        const own = form.locator('.setting', { has: page.getByLabel('Your name') })
        const circle = form.locator('.setting', { has: page.getByLabel('Circle name') })
        assert.match((await form.textContent()) ?? '', /You change it here.*A motion of General assembly changes it/s, `${at}: each setting says what changes it`)
        assert.equal(await page.getByRole('button', { name: /^Save/ }).count(), 0, `${at}: the page has no Save button`)

        await form.getByLabel('Your name').fill('Camille Martin-Roy')
        await form.getByLabel('Your name').press('Tab')
        await own.getByText('Saved', { exact: true }).waitFor()
        assert.deepEqual(posts.posted, [{ action: 'profile', fields: { name: 'Camille Martin-Roy' } }], `${at}: the name, left, posts by its write alone`)
        await page.getByRole('status').filter({ hasText: 'Settled, log entry 901' }).waitFor()

        await form.getByLabel('Your name').fill('')
        await form.getByLabel('Your name').press('Enter')
        await own.getByRole('alert').filter({ hasText: emptied }).waitFor()
        assert.equal(await form.getByLabel('Your name').inputValue(), '', `${at}: refused, the value typed stays`)
        assert.match((await own.textContent()) ?? '', /Not saved/, `${at}: and is marked not saved`)
        await page.screenshot({ path: `${shots}/settings-refused-${name}-${scheme}.png` })

        await form.getByLabel('Circle name').fill('Operations')
        await form.getByLabel('Circle name').press('Enter')
        const dialog = page.getByRole('dialog', { name: 'Propose it instead' })
        await dialog.waitFor()
        assert.equal(posts.posted.length, 2, `${at}: the circle's name posts nothing of its own`)
        assert.equal((await dialog.locator('.why').textContent())?.trim(), refusal, `${at}: the reason is the guard's words`)
        assert.equal(await dialog.getByLabel('Title').inputValue(), 'Rename Coordination to Operations')
        assert.equal(await dialog.locator('select[name="circle"]').inputValue(), 'ag')
        assert.equal(await dialog.getByLabel('Deadline').inputValue(), '23/11/2026')
        assert.equal(await dialog.getByLabel('New name').inputValue(), 'Operations')
        await page.screenshot({ path: `${shots}/settings-dialog-${name}-${scheme}.png` })

        await page.keyboard.press('Escape')
        await dialog.waitFor({ state: 'hidden' })
        assert.equal(await form.getByLabel('Circle name').inputValue(), 'Operations', `${at}: closing keeps what was typed`)
        assert.match((await circle.textContent()) ?? '', /Not saved/, `${at}: and marks it not saved`)
        await page.screenshot({ path: `${shots}/settings-unsaved-${name}-${scheme}.png` })

        await page.keyboard.press('Tab')
        assert.ok(!(await dialog.isVisible()), `${at}: leaving it as focus comes back offers nothing`)
        await form.getByLabel('Circle name').focus()
        await form.getByLabel('Circle name').press('Tab')
        await dialog.waitFor()
        assert.equal(posts.posted.length, 2, `${at}: left again, it offers the motion again and writes nothing`)
        await dialog.getByRole('button', { name: 'Propose' }).click()
        await dialog.waitFor({ state: 'hidden' })
        const proposed = posts.posted[2]
        assert.equal(proposed?.action, 'propose')
        assert.deepEqual(
          { ...proposed.fields, body: undefined },
          { title: 'Rename Coordination to Operations', circle: 'ag', deadline: '2026-11-23', kind: 'amend-circle', 'arg.circle': 'coordination', 'arg.name': 'Operations', body: undefined },
          `${at}: the motion posts as the New form would`,
        )
        await page.getByRole('status').filter({ hasText: 'Settled, log entry 903' }).waitFor()
        assert.doesNotMatch((await circle.textContent()) ?? '', /Not saved/, `${at}: proposed, the change is the motion's`)
        assert.deepEqual(errors, [], `${at}: the page threw nothing`)
        await context.close()
      }
    } finally {
      await browser.close()
      await stop()
    }
  })
})
