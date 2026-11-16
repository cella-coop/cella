// The UI core's own controls, driven as a person drives them, for the
// browser scenarios: no control in the org app is the browser's, so
// Playwright's `selectOption`, `inputValue` on a select and a date
// input's `fill` have nothing to act on. A select is a combobox button
// whose list of options opens in the top layer; a date field's calendar
// is a popover of day buttons, and a time field's list a popover of
// times. A file field's own input stays in the form, hidden, so
// `setInputFiles` on it picks a file as the dialog would.

import type { Locator } from 'playwright-core'

// The listbox a select's combobox opens, found by the id it controls.
const listOf = async (select: Locator) => select.page().locator(`[id="${await select.getAttribute('aria-controls')}"]`)

// The options a select offers, each its value and the label it shows.
export async function offered(select: Locator): Promise<{ value: string; label: string }[]> {
  return (await listOf(select)).locator('[role=option]').evaluateAll((os) =>
    os.map((o) => ({ value: (o as HTMLElement).dataset.value ?? '', label: o.querySelector('.text')?.textContent?.trim() ?? '' })),
  )
}

// The value a select holds, as it would post it.
export const chosen = async (select: Locator) => (await select.getAttribute('data-value')) ?? ''

// Chooses an option by its value, or by its label: opens the list from
// the combobox and presses the option, which closes it.
export async function choose(select: Locator, choice: string | { label: string }) {
  const value = typeof choice === 'string' ? choice : (await offered(select)).find((o) => o.label === choice.label)?.value
  if (value === undefined) {
    throw new Error(`no option labelled ${JSON.stringify((choice as { label: string }).label)}: ${JSON.stringify(await offered(select))}`)
  }
  const list = await listOf(select)
  await select.click()
  await list.waitFor()
  await list.locator(`[role=option][data-value="${value.replace(/["\\]/g, '\\$&')}"]`).click()
  await list.waitFor({ state: 'hidden' })
}

// Picks an ISO day from a date field's calendar, `button` its Choose a
// day: opens it and turns its months until the day shows.
export async function pick(button: Locator, day: string) {
  await button.click()
  const calendar = button.page().locator(`[id="${await button.getAttribute('popovertarget')}"]`)
  await calendar.waitFor()
  const want = day.slice(0, 7)
  for (let turns = 0; turns < 600; turns++) {
    const shown = await calendar.locator('[data-day]').evaluateAll((ds) => ds.map((d) => (d as HTMLElement).dataset.day ?? '')[10]?.slice(0, 7) ?? '')
    if (shown === want) {
      break
    }
    await calendar.getByRole('button', { name: shown < want ? 'Next month' : 'Previous month' }).click()
  }
  await calendar.locator(`[data-day="${day}"]`).click()
  await calendar.waitFor({ state: 'hidden' })
}

// What a select shows: its chosen option's label, or its placeholder.
export const said = async (select: Locator) => ((await select.locator('.value').textContent()) ?? '').trim()

// Picks a time from a time field's list, `button` its Choose a time:
// opens it and presses the time, which closes it.
export async function pickTime(button: Locator, time: string) {
  await button.click()
  const list = button.page().locator(`[id="${await button.getAttribute('popovertarget')}"]`)
  await list.waitFor()
  await list.locator(`[role=option][data-value="${time}"]`).click()
  await list.waitFor({ state: 'hidden' })
}
