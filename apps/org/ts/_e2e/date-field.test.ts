// A browser's date field rejects a day that does not exist, then accepts
// either a corrected day or a calendar pick on that same form.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { browsers, serve, signIn } from './browser.ts'

for (const [name, launch] of browsers()) {
  test(`${name}: a calendar pick clears the typed day's complaint`, async () => {
    const { base, stop } = await serve()
    let browser: Awaited<ReturnType<typeof launch>> | undefined
    try {
      browser = await launch()
      const context = await browser.newContext({ extraHTTPHeaders: { 'x-forwarded-proto': 'http' } })
      await signIn(context, base, 'camille@lanterne.example')
      const page = await context.newPage()
      await page.goto(`${base}/projects`)
      await page.getByRole('button', { name: 'New' }).click()
      const form = page.locator('form').filter({ has: page.getByRole('button', { name: 'Start project' }) })
      const day = form.getByLabel('Due')
      const picker = form.locator('input.picker')
      await form.getByLabel('Title').fill(`A date field in ${name}`)
      // Catch valid form submits before the shell's handler so the scenario
      // checks the browser's constraint validation without creating a project.
      await form.evaluate((el) => el.addEventListener('submit', (event) => {
        event.preventDefault()
        event.stopImmediatePropagation()
        ;(el as HTMLFormElement).dataset.posted = String(new FormData(el as HTMLFormElement).get('due'))
      }, { capture: true }))
      const submit = form.getByRole('button', { name: 'Start project' })
      const posted = () => form.getAttribute('data-posted')
      await day.fill('31/02/2026')
      assert.match(await day.evaluate((el) => (el as HTMLInputElement).validationMessage), /Write the day as/)
      await submit.click()
      assert.equal(await posted(), null, 'invalid typed day blocks the form')

      // A native calendar emits change on its date input. Dispatch it here
      // because the picker is visually hidden and cannot be clicked by a test.
      await picker.evaluate((el) => {
        const input = el as HTMLInputElement
        input.value = '2026-03-01'
        input.dispatchEvent(new Event('change', { bubbles: true }))
      })
      assert.equal(await day.inputValue(), '01/03/2026')
      assert.equal(await day.evaluate((el) => (el as HTMLInputElement).validationMessage), '')
      await submit.click()
      assert.equal(await posted(), '2026-03-01', 'picked day posts in ISO form')

      await day.fill('31/02/2026')
      await day.fill('02/03/2026')
      assert.equal(await day.evaluate((el) => (el as HTMLInputElement).validationMessage), '')
      await submit.click()
      assert.equal(await posted(), '2026-03-02', 'corrected typed day also posts')
    } finally {
      await browser?.close()
      await stop()
    }
  })
}
