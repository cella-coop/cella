// A settings form that mixes the two kinds of setting, in every browser,
// light and dark, on the dev server's specimen (`/specimens/settings`):
// signed in as Camille, her name and Coordination's are changed and
// saved in one go; her name posts by its write alone, and the circle's,
// refused her, opens the dialog proposing the motion instead, its reason
// the guard's words and its form the New form prefilled. Closed, the
// dialog keeps what was typed, marked not saved; proposed, it posts the
// motion and the outcome shows. The specimen has no actions: each post
// is answered here, so nothing is written. `SHOTS` names where its
// screenshots go. Run by `cella test e2e settings`.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import { parse, stringify } from 'devalue'
import type { Page } from 'playwright-core'
import { browsers, serve, signIn } from './browser.ts'

const shots = process.env.SHOTS ?? '/tmp/cella-settings-shots'
const refusal = 'camille@lanterne.example holds no amend-circle in coordination: only a motion of General assembly renames it'

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

for (const [name, launch] of browsers()) {
  test(`${name}: a mixed settings form saves the one kind and proposes the motion for the other, light and dark`, async () => {
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
        assert.match((await form.textContent()) ?? '', /You change it here.*A motion of General assembly changes it/s, `${at}: each setting says what changes it`)
        const save = form.getByRole('button', { name: 'Save' })
        assert.ok(await save.isDisabled(), `${at}: nothing changed, nothing to save`)
        await form.getByLabel('Your name').fill('Camille Martin-Roy')
        await form.getByLabel('Circle name').fill('Operations')
        await save.click()

        const dialog = page.getByRole('dialog', { name: 'Propose it instead' })
        await dialog.waitFor()
        assert.deepEqual(posts.posted, [{ action: 'profile', fields: { name: 'Camille Martin-Roy' } }], `${at}: only the name posts, by its write`)
        assert.equal((await dialog.locator('.why').textContent())?.trim(), refusal, `${at}: the reason is the guard's words`)
        assert.equal(await dialog.getByLabel('Title').inputValue(), 'Rename Coordination to Operations')
        assert.equal(await dialog.locator('select[name="circle"]').inputValue(), 'ag')
        assert.equal(await dialog.getByLabel('Deadline').inputValue(), '23/11/2026')
        assert.equal(await dialog.getByLabel('New name').inputValue(), 'Operations')
        await page.screenshot({ path: `${shots}/settings-dialog-${name}-${scheme}.png` })

        await dialog.getByRole('button', { name: 'Keep editing' }).click()
        await dialog.waitFor({ state: 'hidden' })
        assert.equal(await form.getByLabel('Circle name').inputValue(), 'Operations', `${at}: closing keeps what was typed`)
        assert.match((await form.textContent()) ?? '', /Not saved/, `${at}: and marks it not saved`)
        await page.screenshot({ path: `${shots}/settings-unsaved-${name}-${scheme}.png` })

        await save.click()
        await dialog.waitFor()
        assert.equal(posts.posted.length, 1, `${at}: the second Save writes nothing, the name saved already`)
        await dialog.getByRole('button', { name: 'Propose' }).click()
        await dialog.waitFor({ state: 'hidden' })
        const proposed = posts.posted[1]
        assert.equal(proposed?.action, 'propose')
        assert.deepEqual(
          { ...proposed.fields, body: undefined },
          { title: 'Rename Coordination to Operations', circle: 'ag', deadline: '2026-11-23', kind: 'amend-circle', 'arg.circle': 'coordination', 'arg.name': 'Operations', body: undefined },
          `${at}: the motion posts as the New form would`,
        )
        await page.getByRole('status').filter({ hasText: 'Settled, log entry 902' }).waitFor()
        assert.doesNotMatch((await form.textContent()) ?? '', /Not saved/, `${at}: proposed, the change is the motion's`)
        assert.deepEqual(errors, [], `${at}: the page threw nothing`)
        await context.close()
      }
    } finally {
      await browser.close()
      await stop()
    }
  })
}
