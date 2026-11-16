// The UI core's time field and file picker, never the browser's: a time
// typed the French way or picked from its own list by the keyboard alone
// posts as HH:MM, and one that names none holds the form back; a file
// chosen, dropped or cleared shows by its name and size and posts with
// the form, and a required picker left empty says so. Nothing is
// written: each form's submit is caught before the shell's handler.
// covers: meeting file
import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Locator, Page } from 'playwright-core'
import { eachBrowser, serve, signIn } from './browser.ts'
import { pickTime } from './controls.ts'

// Catches the form's valid submits, keeping what it would post under the
// field's name, `f.<name>[]/<form>`: a file by its name.
const catching = (form: Locator, name: string) =>
  form.evaluate(
    (el, name) =>
      el.addEventListener(
        'submit',
        (event) => {
          event.preventDefault()
          event.stopImmediatePropagation()
          const v = [...new FormData(el as HTMLFormElement)].find(([k]) => k.startsWith(`f.${name}[`))?.[1]
          ;(el as HTMLFormElement).dataset.posted = v instanceof File ? `file:${v.name}` : String(v ?? null)
        },
        { capture: true },
      ),
    name,
  )

const active = (page: Page) => page.evaluate(() => (document.activeElement as HTMLElement | null)?.getAttribute('aria-label') ?? document.activeElement?.textContent?.trim() ?? null)

eachBrowser((name, launch) => {
  test(`${name}: a time is typed or picked by the keyboard, and a file chosen, dropped or cleared`, async () => {
    const { base, stop } = await serve()
    let browser: Awaited<ReturnType<typeof launch>> | undefined
    try {
      browser = await launch()
      const context = await browser.newContext({ extraHTTPHeaders: { 'x-forwarded-proto': 'http' } })
      await signIn(context, base, 'camille@lanterne.example')
      const page = await context.newPage()

      // A meeting's time.
      await page.goto(`${base}/meetings`)
      await page.getByRole('button', { name: 'New' }).click()
      const form = page.locator('form').filter({ has: page.getByRole('button', { name: 'Schedule meeting' }) })
      await catching(form, 'time')
      const posted = () => form.getAttribute('data-posted')
      const submit = form.getByRole('button', { name: 'Schedule meeting' })
      const time = form.getByLabel('Time', { exact: true })
      const choose = form.getByRole('button', { name: 'Choose a time' })
      assert.equal(await time.getAttribute('type'), 'text', 'the time is no browser time input')
      assert.equal(await time.inputValue(), '10:00', 'it shows the time it is drawn with')
      await form.getByLabel('Title', { exact: true }).fill(`A time field in ${name}`)
      await form.getByLabel('Circle', { exact: true }).fill('coordination')
      await form.getByLabel('Day', { exact: true }).fill('02/11/2026')

      await time.fill('25:00')
      assert.match(await time.evaluate((el) => (el as HTMLInputElement).validationMessage), /Write the time as hh:mm/)
      await submit.click()
      assert.equal(await posted(), null, 'a time that names none holds the form back')

      await time.fill('9h30')
      assert.equal(await time.evaluate((el) => (el as HTMLInputElement).validationMessage), '')
      await submit.click()
      assert.equal(await posted(), '09:30', 'a time typed the French way posts as HH:MM')

      // By the keyboard alone: the list opens on the field's time, the
      // arrows move a quarter, figures typed reach the time they start,
      // Enter picks and Escape closes it, the focus back on its button.
      await choose.focus()
      await page.keyboard.press('Enter')
      const list = page.getByRole('listbox', { name: 'Times' })
      // The list takes the focus once it opens, on its next frame.
      const opened = async () => {
        await list.waitFor()
        await list.evaluate((el) => new Promise<void>((done) => {
          const tick = () => (el === document.activeElement ? done() : requestAnimationFrame(tick))
          tick()
        }))
      }
      await opened()
      // The time the keyboard is on, waited for as the date field's test
      // waits for its day: the list answers a key on its next frame.
      const at = async () => {
        const id = await list.getAttribute('aria-activedescendant')
        return id ? page.locator(`[id="${id}"]`).getAttribute('data-value') : null
      }
      const on = async (want: string) => {
        for (let tries = 0; tries < 40 && (await at()) !== want; tries++) {
          await page.waitForTimeout(50)
        }
        return at()
      }
      assert.equal(await on('09:30'), '09:30', 'the list opens on the field\'s time')
      await page.keyboard.press('ArrowDown')
      assert.equal(await on('09:45'), '09:45', 'an arrow moves a quarter')
      await page.keyboard.press('PageDown')
      assert.equal(await on('10:45'), '10:45', 'Page Down moves an hour')
      await page.keyboard.type('14')
      assert.equal(await on('14:00'), '14:00', 'figures typed reach the time they start')
      await page.keyboard.press('Enter')
      await list.waitFor({ state: 'hidden' })
      assert.equal(await time.inputValue(), '14:00')
      assert.ok(await choose.evaluate((el) => el === document.activeElement), 'a pick gives the focus back to its button')
      await page.keyboard.press('Enter')
      await opened()
      await page.keyboard.press('End')
      assert.equal(await on('23:45'), '23:45', 'End reaches the day\'s last time')
      await page.keyboard.press('Escape')
      await list.waitFor({ state: 'hidden' })
      assert.ok(await choose.evaluate((el) => el === document.activeElement), 'Escape gives the focus back')
      assert.equal(await time.inputValue(), '14:00', 'Escape picks nothing')
      assert.ok(await form.isVisible(), 'Escape closes the list alone, not the dialog')

      await pickTime(choose, '16:45')
      assert.equal(await time.inputValue(), '16:45')
      await submit.click()
      assert.equal(await posted(), '16:45', 'a time picked by a press posts')
      await page.keyboard.press('Escape')

      // A file of the co-op's own.
      await page.goto(`${base}/files`)
      await page.getByRole('button', { name: 'New' }).click()
      const upload = page.locator('form').filter({ has: page.getByRole('button', { name: 'Upload' }) })
      await catching(upload, 'file')
      const sent = () => upload.getAttribute('data-posted')
      const picker = upload.getByRole('button', { name: 'File Choose file', exact: true })
      assert.equal(await picker.evaluate((el) => el.tagName), 'BUTTON', 'the label and its text name the picker\'s Choose file')
      assert.ok(!(await upload.locator('input[type=file]').isVisible()), 'the browser\'s file input is never seen')

      await upload.getByRole('button', { name: 'Upload' }).click()
      assert.equal(await sent(), null, 'a required picker left empty holds the form back')
      await upload.locator('.complaint').filter({ hasText: 'Choose a file.' }).waitFor()
      assert.equal(await active(page), 'Choose file', 'and sends the focus to its button')

      await upload.locator('input[type=file]').setInputFiles({ name: 'statuts.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(24_000, 1) })
      await upload.getByText('statuts.pdf', { exact: true }).waitFor()
      await upload.getByText('24 KB', { exact: true }).waitFor()
      assert.match((await upload.locator('[aria-live=polite]').textContent()) ?? '', /Chosen: statuts\.pdf, 24 KB/, 'the file chosen is read aloud')
      assert.equal(await upload.locator('.complaint').count(), 0, 'a file chosen drops the complaint')
      await upload.getByRole('button', { name: 'Upload' }).click()
      assert.equal(await sent(), 'file:statuts.pdf', 'the file chosen posts with the form')

      await upload.getByRole('button', { name: 'Clear statuts.pdf' }).click()
      assert.equal(await upload.getByText('statuts.pdf', { exact: true }).count(), 0, 'clearing it drops the file')
      assert.equal(await upload.locator('input[type=file]').evaluate((el) => (el as HTMLInputElement).files?.length ?? 0), 0)
      assert.equal(await active(page), 'Choose file', 'and gives the focus to Choose file')

      // A file dropped on it is taken as one chosen.
      await upload.locator('.file').evaluate((zone) => {
        const put = new DataTransfer()
        put.items.add(new File(['reglement'], 'reglement-v3.pdf', { type: 'application/pdf' }))
        zone.dispatchEvent(new DragEvent('drop', { dataTransfer: put, bubbles: true, cancelable: true }))
      })
      await upload.getByText('reglement-v3.pdf', { exact: true }).waitFor()
      await upload.getByRole('button', { name: 'Upload' }).click()
      assert.equal(await sent(), 'file:reglement-v3.pdf', 'a dropped file posts with the form')
    } finally {
      await browser?.close()
      await stop()
    }
  })
})
