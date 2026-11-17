// A calendar grouped by a field colours each card by its value, in every
// browser, light and dark: signed in as Camille on the dev server, the
// meetings' calendar of October 2026 grouped by their circle in the View
// panel. Each card wears its circle's ink, every card of a circle the
// same and no two of the month's circles alike; a legend over the days
// names each circle and how many of the month's meetings it holds, as the
// scenario works them out from the rows themselves; every text of the
// legend and of the cards clears WCAG AA's 4.5:1 on what it is drawn on,
// measured in the browser; the address holds the grouping, and a reload
// draws the same legend from it. None takes the colours away. `SHOTS`
// names where its screenshots go. Nothing is written. Run by `cella test
// e2e colour`.
// covers: meeting

import { after, before, test } from 'node:test'
import { mkdirSync } from 'node:fs'
import assert from 'node:assert/strict'
import pg from 'pg'
import type { Page } from 'playwright-core'
import { page as read, type Source } from '@cella/org-db'
import { period } from '@cella/org-ui/models'
import { source } from '#lib/server/slices.ts'
import { eachBrowser, serve, signIn } from './browser.ts'
import { choose, chosen } from './controls.ts'

const camille = 'camille@lanterne.example'
const shots = process.env.SHOTS ?? '/tmp/cella-colour-shots'
const app = new pg.Client({ user: 'cella_app' })

before(async () => {
  await app.connect()
  await app.query(`SELECT set_config('cella.actor', $1, false)`, [camille])
})

after(async () => {
  await app.end()
})

type Row = Record<string, unknown> & { id: string }

// How many of the month's meetings each circle holds, by its name, from
// the rows themselves: those whose day falls on the month's grid.
async function expected(): Promise<Record<string, number>> {
  const { days } = period('2026-10-01', 'month', '2026-10-01')
  const shown = new Set(days.map((d) => d.day))
  const rows = ((await read(app, source('meetings') as Source, { where: [] })) as Row[]).filter((r) => shown.has(String(r.at ?? '').slice(0, 10)))
  const names = Object.fromEntries((await app.query<{ id: string; name: string }>('SELECT id, name FROM circle.circle')).rows.map((c) => [c.id, c.name]))
  const out: Record<string, number> = {}
  for (const r of rows) {
    const name = r.circle ? (names[String(r.circle)] ?? String(r.circle)) : 'None'
    out[name] = (out[name] ?? 0) + 1
  }
  return out
}

const panel = (page: Page) => page.locator('section.card', { has: page.getByRole('heading', { name: 'View', exact: true }) })

// What the calendar draws: its legend, each value's name, its count and
// its swatch's colour, and each card's circle, as the row holds it, and
// its ground.
async function drawn(page: Page) {
  return page.locator('.calendar').evaluate((el) => {
    const legend = [...document.querySelectorAll('ul[aria-label^="By"] li')].map((li) => {
      const count = li.querySelector('.count')
      const label = li.querySelector('.prop, .none')?.textContent?.trim() ?? ''
      return { label, count: Number(count?.textContent ?? -1), swatch: getComputedStyle(li.querySelector('.swatch')!).backgroundColor }
    })
    const cards = [...el.querySelectorAll('li.entry')].map((e) => ({ inked: e.classList.contains('inked'), ground: getComputedStyle(e).backgroundColor, wash: getComputedStyle(e).getPropertyValue('--wash').trim() }))
    return { legend, cards }
  })
}

// Every text the legend and the cards draw, its contrast on what it is
// drawn on: its colour laid over its ground, the grounds of it and its
// ancestors laid one over another from the page down, each read back as
// sRGB from a canvas, so a translucent or an OKLCH colour measures as
// the browser draws it.
async function contrasts(page: Page): Promise<{ text: string; ratio: number }[]> {
  return page.locator('.calendar').evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 1
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!
    const lum = ([r, g, b]: number[]) => {
      const c = [r, g, b].map((v) => {
        const s = v / 255
        return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
      })
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
    }
    const grounds = (el: Element | null): string[] => {
      const out: string[] = []
      for (let e = el; e; e = e.parentElement) {
        out.unshift(getComputedStyle(e).backgroundColor)
      }
      return out
    }
    const paint = (layers: string[]) => {
      ctx.globalCompositeOperation = 'source-over'
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, 1, 1)
      for (const l of layers) {
        ctx.fillStyle = l
        ctx.fillRect(0, 0, 1, 1)
      }
      return [...ctx.getImageData(0, 0, 1, 1).data.slice(0, 3)]
    }
    const out: { text: string; ratio: number }[] = []
    for (const el of document.querySelectorAll('ul[aria-label^="By"] li *, .calendar li.entry, .calendar li.entry *')) {
      const own = [...el.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim())
      if (!own) {
        continue
      }
      const under = grounds(el)
      const ground = lum(paint(under))
      const ink = lum(paint([...under, getComputedStyle(el).color]))
      const [hi, lo] = ground > ink ? [ground, ink] : [ink, ground]
      out.push({ text: el.textContent!.trim(), ratio: (hi + 0.05) / (lo + 0.05) })
    }
    return out
  })
}

eachBrowser((browserName, launch) => {
  test(`${browserName}: a calendar grouped by a field colours each card by its value, with a legend, light and dark, saved in the address`, async () => {
    const want = await expected()
    assert.ok(Object.keys(want).length > 1, 'October 2026 holds meetings of more than one circle')
    mkdirSync(shots, { recursive: true })
    const { base, stop } = await serve()
    const browser = await launch()
    try {
      for (const scheme of ['light', 'dark'] as const) {
        const at = `${browserName}, ${scheme}`
        const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, colorScheme: scheme, extraHTTPHeaders: { 'x-forwarded-proto': 'http' } })
        await signIn(context, base, camille)
        const page = await context.newPage()
        const errors: string[] = []
        page.on('pageerror', (e) => errors.push(`${page.url()}: ${e.message}`))
        // The meetings open coloured by their circle; asked for nothing,
        // the calendar has no legend.
        await page.goto(`${base}/meetings?at=2026-10-01&by=`)
        await page.waitForLoadState('networkidle')
        assert.equal(await page.locator('ul[aria-label^="By"]').count(), 0, `${at}: grouped by nothing, no legend`)

        // Colour by the circle in the View panel: the address takes it.
        const view = panel(page)
        const by = view.getByRole('combobox', { name: 'Colour by' })
        assert.equal(await chosen(by), '', `${at}: the calendar is coloured by nothing at first`)
        await choose(by, { label: 'Circle' })
        // The circle is the meetings' own colour, which the address need
        // not name.
        await page.waitForURL((u) => !u.searchParams.has('by'))
        assert.equal(page.url().includes('at=2026-10-01'), true, `${at}: where the viewer is stays`)

        // The legend, then the cards, polled until the address is drawn.
        const check = async (when: string) => {
          let last = await drawn(page)
          for (let tries = 0; tries < 60 && last.legend.length !== Object.keys(want).length; tries++) {
            await page.waitForTimeout(250)
            last = await drawn(page)
          }
          const named = Object.fromEntries(last.legend.map((k) => [k.label, k.count]))
          assert.deepEqual(named, want, `${at}, ${when}: the legend names each circle with its meetings`)
          const inked = last.legend.filter((k) => k.label !== 'None')
          assert.equal(new Set(inked.map((k) => k.swatch)).size, Math.min(inked.length, 5), `${at}, ${when}: no two circles share an ink, of five`)
          assert.equal(last.cards.length, Object.values(want).reduce((a, b) => a + b, 0), `${at}, ${when}: every meeting of the month is a card`)
          assert.ok(last.cards.every((c) => c.inked === (c.wash !== '')), `${at}, ${when}: a card wearing an ink is grounded by it`)
          assert.equal(new Set(last.cards.filter((c) => c.inked).map((c) => c.ground)).size, Math.min(inked.length, 5), `${at}, ${when}: each circle's cards wear one ground`)
          const low = (await contrasts(page)).filter((c) => c.ratio < 4.5)
          assert.deepEqual(low, [], `${at}, ${when}: every text of the legend and the cards clears AA`)
        }
        await check('chosen')
        await page.screenshot({ path: `${shots}/meetings-${browserName}-${scheme}.png`, fullPage: true })

        // A reload of the address, the meetings' default, draws the same.
        await page.reload()
        await page.waitForLoadState('networkidle')
        assert.equal(await chosen(panel(page).getByRole('combobox', { name: 'Colour by' })), 'circle', `${at}: the reload keeps the grouping`)
        await check('reloaded')

        // None takes the colours away.
        await choose(panel(page).getByRole('combobox', { name: 'Colour by' }), { label: 'None' })

        await page.waitForURL((u) => u.searchParams.get('by') === '')
        for (let tries = 0; tries < 60 && (await page.locator('ul[aria-label^="By"]').count()) > 0; tries++) {
          await page.waitForTimeout(250)
        }
        assert.equal(await page.locator('ul[aria-label^="By"]').count(), 0, `${at}: None draws no legend`)
        assert.equal(await page.locator('.calendar li.entry.inked').count(), 0, `${at}: None inks no card`)

        assert.deepEqual(errors, [], `${at}: no page error`)
        await context.close()
      }
    } finally {
      await browser.close()
      await stop()
    }
  })
})
