// The UI core's date field rejects a day that does not exist, then accepts
// either a corrected day or a pick from its own calendar on that same
// form; the calendar answers its keyboard and gives the focus back.
// covers: project
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { eachBrowser, serve, signIn } from './browser.ts'
import { pick } from './controls.ts'

eachBrowser((name, launch) => {
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
      const calendar = form.getByRole('button', { name: 'Choose a day' })
      await form.getByLabel('Title').fill(`A date field in ${name}`)
      // Catch valid form submits before the shell's handler so the scenario
      // checks the browser's constraint validation without creating a project.
      await form.evaluate((el) => el.addEventListener('submit', (event) => {
        event.preventDefault()
        event.stopImmediatePropagation()
        // The field is bound to the form's `write` by name, `f.due[]/<form>`.
        ;(el as HTMLFormElement).dataset.posted = String([...new FormData(el as HTMLFormElement)].find(([k]) => k.startsWith('f.due['))?.[1] ?? null)
      }, { capture: true }))
      const submit = form.getByRole('button', { name: 'Start project' })
      const posted = () => form.getAttribute('data-posted')
      await day.fill('31/02/2026')
      assert.match(await day.evaluate((el) => (el as HTMLInputElement).validationMessage), /Write the day as/)
      await submit.click()
      assert.equal(await posted(), null, 'invalid typed day blocks the form')

      await pick(calendar, '2026-03-01')
      assert.equal(await day.inputValue(), '01/03/2026')
      assert.ok(await calendar.evaluate((el) => el === document.activeElement), 'a pick gives the focus back to the calendar button')

      assert.equal(await day.evaluate((el) => (el as HTMLInputElement).validationMessage), '')
      await submit.click()
      assert.equal(await posted(), '2026-03-01', 'picked day posts in ISO form')

      await day.fill('31/02/2026')
      await day.fill('02/03/2026')
      assert.equal(await day.evaluate((el) => (el as HTMLInputElement).validationMessage), '')
      await submit.click()
      assert.equal(await posted(), '2026-03-02', 'corrected typed day also posts')

      // By the keyboard alone: the calendar opens on the field's day, the
      // arrows move a day, Page Down a month, Enter picks, and Escape
      // closes it with the focus back on its button.
      await calendar.focus()
      await page.keyboard.press('Enter')
      const focused = () => page.evaluate(() => (document.activeElement as HTMLElement | null)?.dataset.day ?? null)
      for (let tries = 0; tries < 40 && (await focused()) !== '2026-03-02'; tries++) {
        await page.waitForTimeout(50)
      }
      assert.equal(await focused(), '2026-03-02', 'the calendar opens on the field\'s day')
      await page.keyboard.press('ArrowRight')
      await page.keyboard.press('PageDown')
      assert.equal(await focused(), '2026-04-03')
      await page.keyboard.press('Enter')
      assert.equal(await day.inputValue(), '03/04/2026')
      await calendar.focus()
      await page.keyboard.press('Enter')
      await page.getByRole('dialog', { name: 'Calendar' }).waitFor()
      await page.keyboard.press('Escape')
      await page.getByRole('dialog', { name: 'Calendar' }).waitFor({ state: 'hidden' })
      assert.ok(await calendar.evaluate((el) => el === document.activeElement), 'Escape gives the focus back')
      assert.equal(await day.inputValue(), '03/04/2026', 'Escape picks nothing')

    } finally {
      await browser?.close()
      await stop()
    }
  })
})
