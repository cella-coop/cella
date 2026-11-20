// A card is dragged across a board by the pointer, in every browser:
// signed in as Camille on the dev server, she presses a card in the task
// board's Next column, carries it into Active with real pointer moves
// and lets go; the card is a link, yet the browser starts no drag of its
// own, the drop is a move signed as her, and the card stays in Active
// once the page is drawn again. A plain click on a card still opens the
// task. Run by `cella test e2e board`.
// covers: task

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { eachBrowser, serve, signIn } from './browser.ts'

const camille = 'camille@lanterne.example'
const su = new pg.Client()

before(async () => {
  await su.connect()
})

after(async () => {
  await su.end()
})

eachBrowser((browserName, launch) => {
  test(`${browserName}: a card dragged from Next into Active moves there, and a click still opens it`, async () => {
    const { base, stop } = await serve()
    const browser = await launch()
    try {
      const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, extraHTTPHeaders: { 'x-forwarded-proto': 'http' } })
      await signIn(context, base, camille)
      const page = await context.newPage()
      const errors: string[] = []
      page.on('pageerror', (e) => errors.push(e.message))
      await page.goto(`${base}/tasks`)
      await page.waitForLoadState('networkidle')

      // The board splits into a swimlane per project, each with the whole
      // set of columns under the one header row; a card moves within its
      // own lane, so Active is its lane's.
      const lane = (name: string) => page.locator(`[data-drop-list="${name}"]`)
      const first = lane('next').locator('a[data-drag-item]').first()
      const id = await first.getAttribute('data-drag-id')
      assert.ok(id, 'Next holds a card')
      const card = page.locator(`a[data-drag-id="${id}"]`)
      const swim = page.locator('section.swimlane', { has: card })
      const into = swim.locator('[data-drop-list="active"]')
      const held = () => page.locator(`[data-drop-list="active"] a[data-drag-id="${id}"]`)
      assert.equal(await card.getAttribute('draggable'), 'false', 'the link starts no drag of the browser\'s own')

      // Pressed, carried in small steps as a hand moves, and let go over
      // Active; a native drag would cancel the pointer and snap it back.
      let natives = 0
      await page.exposeFunction('__native', () => natives++)
      await page.evaluate(() => window.addEventListener('dragstart', () => (window as any).__native(), true))
      const from = (await card.boundingBox())!
      const to = (await into.boundingBox())!
      await page.mouse.move(from.x + 30, from.y + 10)
      await page.mouse.down()
      await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 20 })
      await page.mouse.up()
      assert.equal(natives, 0, 'the browser started no drag of its own')

      await into.locator(`a[data-drag-id="${id}"]`).waitFor()
      for (let i = 0; i < 50; i++) {
        const { rows } = await su.query(`SELECT status FROM task.task WHERE id = $1`, [id])
        if (rows[0]?.status === 'active') {
          break
        }
        await page.waitForTimeout(100)
      }
      const { rows } = await su.query(`SELECT status FROM task.task WHERE id = $1`, [id])
      assert.equal(rows[0]?.status, 'active', 'the drop moved it, signed and settled')
      const { rows: entries } = await su.query(`SELECT count(*)::int AS n FROM cella.log WHERE op = 'task:task:move' AND actor = $1`, [camille])
      assert.ok(entries[0].n >= 1, 'the move is in the log, as hers')
      await page.reload()
      await page.waitForLoadState('networkidle')
      assert.equal(await held().count(), 1, 'drawn again, it is still in Active')

      // A click is not a drag: it opens the task.
      await held().click()
      await page.waitForURL(`${base}/tasks/${id}`)
      assert.deepEqual(errors, [])
    } finally {
      await browser.close()
      await stop()
    }
  })
})
