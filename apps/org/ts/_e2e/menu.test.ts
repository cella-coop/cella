// The context menu, the UI core's (`ContextMenu`), on a collection's view
// chips: first its moves as plain data, where the arrows, the first
// letters and the window's edges take it; then, in every browser, signed
// in as Camille on the tasks, a view of her own saved and its chip's menu
// driven. Shift+F10 on the focused chip opens it on its first item, the
// arrows and End move, the right arrow opens Icon's submenu, a letter
// reaches Star, Enter chooses it and the focus is back on the chip;
// Escape leaves the submenu, then shuts the menu, the focus back on the
// chip. From its ⋯, Rename makes the chip an input, Enter keeps the name
// and Escape drops another; a right click pins it under Pinned and
// unpins it; All's menu offers what a preset can be, Pin and Duplicate,
// never Rename or Delete, and Duplicate opens the copy; a press outside
// shuts it; Delete removes a view, and deleting the open one leaves for
// All. Light and dark, the menu open on a chip with its submenu is
// screenshot where `SHOTS` says. It writes nothing to the log. Run by
// `cella test e2e menu`.
// covers: task

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import type { Page } from 'playwright-core'
import { menu } from '@cella/org-ui/models'
import { eachBrowser, serve, signIn } from './browser.ts'

const shots = process.env.SHOTS ?? '/tmp/cella-menu-shots'

const entries: menu.Entry[] = [{ label: 'Rename' }, { label: 'Icon', items: [] }, { label: 'Pin to sidebar' }, menu.rule, { label: 'Move', disabled: 'You hold no power to move it' }, { label: 'Delete', danger: true }]

test('the arrows wrap past either end and over a rule, and stop on a disabled item, whose reason is read there', () => {
  assert.equal(menu.step(entries, -1, 1), 0, 'from none, down is the first')
  assert.equal(menu.step(entries, -1, -1), 5, 'from none, up is the last')
  assert.equal(menu.step(entries, 2, 1), 4, 'the rule is passed over, the disabled item is not')
  assert.equal(menu.step(entries, 5, 1), 0, 'past the last, the first')
  assert.equal(menu.step(entries, 0, -1), 5, 'before the first, the last')
  assert.equal(menu.end(entries, 'last'), 5)
  assert.equal(menu.choosable(entries[4]), false, 'a disabled item is never chosen')
  assert.equal(menu.choosable(entries[3]), false, 'nor a rule')
})

test('a letter reaches the next item it starts, cycling through those it starts', () => {
  assert.equal(menu.typed(entries, 0, 'p'), 2)
  assert.equal(menu.typed(entries, 0, 'd'), 5)
  assert.equal(menu.typed(entries, 2, 'pi'), 2, 'a longer run keeps the item it is on')
  assert.equal(menu.typed(entries, 0, 'x'), 0, 'no match stays')
})

test('a menu is kept inside the window, flipped to end where it opened where it would pass an edge', () => {
  assert.deepEqual(menu.fit({ x: 100, y: 100 }, 200, 150, 1000, 800), { left: 100, top: 100 }, 'room enough: where it opened')
  assert.deepEqual(menu.fit({ x: 900, y: 700, before: 900, above: 700 }, 200, 150, 1000, 800), { left: 700, top: 550 }, 'at the corner: up and to the left of the point')
  assert.deepEqual(menu.fit({ x: 990, y: 10, before: 800 }, 200, 150, 1000, 800), { left: 600, top: 10 }, "a submenu flips to its parent's other side")
  assert.deepEqual(menu.fit({ x: 990, y: 10, before: 100 }, 200, 150, 1000, 800), { left: 792, top: 10 }, 'with no room either side, held inside the margin')
})

// The element holding the focus, by its role and name.
const focused = (page: Page) =>
  page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null
    const role = el?.getAttribute('role') ?? (el?.tagName === 'A' ? 'link' : el?.tagName.toLowerCase())
    return el ? `${role}: ${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim()}` : ''
  })

// Once the menus have faded in, for a screenshot.
const settled = (page: Page) => page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)))

// The views Pinned lists, by name.
const pins = (page: Page) =>
  page
    .getByRole('navigation', { name: 'Main' })
    .locator('.pinned a')
    .evaluateAll((as) => as.map((a) => a.textContent?.trim() ?? ''))

// The icon each of the viewer's views of the tasks wears, as kept.
const icons = (page: Page) => page.evaluate(() => (JSON.parse(localStorage.getItem('cella-views') ?? '{}').views?.tasks ?? []).map((c: { name: string; icon?: string }) => `${c.name}: ${c.icon}`))

eachBrowser((engine, launch) => {
  test(`${engine}: a view chip's menu, by the keyboard, the pointer and its ⋯, light and dark`, async () => {
    mkdirSync(shots, { recursive: true })
    const { base, stop } = await serve()
    const browser = await launch()
    try {
      for (const scheme of ['light', 'dark'] as const) {
        const at = `${engine}, ${scheme}`
        const context = await browser.newContext({ viewport: { width: 1280, height: 860 }, colorScheme: scheme, extraHTTPHeaders: { 'x-forwarded-proto': 'http' } })
        await signIn(context, base, 'camille@lanterne.example')
        await context.addCookies([{ name: 'cella-theme', value: scheme, url: base }])
        const page = await context.newPage()
        const errors: string[] = []
        page.on('pageerror', (e) => errors.push(`${page.url()}: ${e.message}`))
        await page.goto(`${base}/tasks`)
        await page.waitForLoadState('networkidle')
        const bar = page.getByRole('navigation', { name: 'Views' })
        const chip = (name: string) => bar.getByRole('link', { name, exact: true })
        const opened = (name: string) => page.getByRole('menu', { name, exact: true })

        // Her own view, saved from the view bar's +.
        await page.getByRole('button', { name: 'Save this as a view' }).click()
        await page.getByLabel('Rename view Untitled view').fill('Mine')
        await page.getByLabel('Rename view Untitled view').press('Enter')
        await page.waitForURL(/[?&]v=c-/)
        await page.waitForLoadState('networkidle')
        await chip('Mine').waitFor()

        // Shift+F10 on the focused chip: the menu on its first item.
        await chip('Mine').focus()
        await bar.getByRole('button', { name: 'Actions for view Mine' }).evaluate((el) => new Promise((done) => {
          const seen = () => (getComputedStyle(el).opacity === '1' ? done(null) : requestAnimationFrame(seen))
          seen()
        }))
        await page.keyboard.press('Shift+F10')
        const mine = opened('view Mine')
        await mine.waitFor()
        assert.deepEqual(
          await mine.getByRole('menuitem').allTextContents().then((ts) => ts.map((t) => t.trim())),
          ['Rename', 'Icon', 'Pin to sidebar', 'Duplicate', 'Delete'],
          `${at}: her view renames, takes an icon, pins, duplicates and deletes`,
        )
        assert.equal(await mine.getByRole('separator').count(), 1, `${at}: Delete is ruled off`)
        assert.equal(await focused(page), 'menuitem: Rename', `${at}: the keyboard opens it on its first item`)
        await page.keyboard.press('End')
        assert.equal(await focused(page), 'menuitem: Delete', `${at}: End is the last`)
        await page.keyboard.press('ArrowDown')
        assert.equal(await focused(page), 'menuitem: Rename', `${at}: the arrows wrap`)
        await page.keyboard.press('ArrowDown')
        const icon = mine.getByRole('menuitem', { name: 'Icon' })
        assert.equal(await icon.getAttribute('aria-haspopup'), 'menu', `${at}: Icon opens a submenu`)
        await page.keyboard.press('ArrowRight')
        const icons_ = opened('Icon')
        await icons_.waitFor()
        assert.equal(await icon.getAttribute('aria-expanded'), 'true', `${at}: Icon reads as open`)
        // Measured once its scale-in has ended, not mid-animation.
        await settled(page)
        const sub = await icons_.boundingBox()
        const parent = await mine.boundingBox()
        assert.ok(sub && parent && sub.x >= parent.x + parent.width - 8, `${at}: the submenu opens beside the menu`)
        assert.equal(await icons_.locator('[role=menuitemradio][aria-checked=true]').textContent().then((t) => t?.trim()), 'Bookmark', `${at}: the icon she wears is checked`)
        await page.screenshot({ path: `${shots}/menu-submenu-${engine}-${scheme}.png` })
        await page.keyboard.press('Escape')
        await icons_.waitFor({ state: 'detached' })
        assert.equal(await focused(page), 'menuitem: Icon', `${at}: Escape leaves the submenu, back on Icon`)
        await page.keyboard.press('ArrowRight')
        await icons_.waitFor()
        await page.keyboard.press('ArrowLeft')
        await icons_.waitFor({ state: 'detached' })
        assert.equal(await focused(page), 'menuitem: Icon', `${at}: so does the left arrow`)
        await page.keyboard.press('Enter')
        await icons_.waitFor()
        await page.keyboard.press('s')
        assert.equal(await focused(page), 'menuitemradio: Star', `${at}: a letter reaches the item it starts`)
        await page.keyboard.press('Enter')
        await mine.waitFor({ state: 'detached' })
        assert.deepEqual(await icons(page), ['Mine: star'], `${at}: she wears the star`)
        assert.equal(await focused(page), 'link: Mine', `${at}: choosing puts the focus back on the chip`)

        // Escape shuts it, the focus back on the chip.
        await page.keyboard.press('Shift+F10')
        await mine.waitFor()
        await page.keyboard.press('Escape')
        await mine.waitFor({ state: 'detached' })
        assert.equal(await focused(page), 'link: Mine', `${at}: Escape puts the focus back on the chip`)

        // Rename, from its ⋯: the chip an input, Enter keeps the name.
        await chip('Mine').hover()
        await bar.getByRole('button', { name: 'Actions for view Mine' }).click()
        await mine.waitFor()
        await settled(page)
        await page.screenshot({ path: `${shots}/menu-${engine}-${scheme}.png` })
        await mine.getByRole('menuitem', { name: 'Rename' }).click()
        const rename = bar.getByRole('textbox', { name: 'Rename view Mine' })
        await rename.waitFor()
        assert.ok(await rename.evaluate((el) => el === document.activeElement), `${at}: the input takes the focus`)
        await rename.fill('Ours')
        await rename.press('Enter')
        await chip('Ours').waitFor()
        assert.equal(await focused(page), 'link: Ours', `${at}: Enter keeps the name, back on the chip`)
        await page.keyboard.press('Shift+F10')
        await opened('view Ours').waitFor()
        await page.keyboard.press('Enter')
        await bar.getByRole('textbox', { name: 'Rename view Ours' }).fill('Nope')
        await page.keyboard.press('Escape')
        await chip('Ours').waitFor()
        assert.equal(await chip('Nope').count(), 0, `${at}: Escape drops the name`)

        // A right click pins it, and unpins it.
        const ours = opened('view Ours')
        await chip('Ours').click({ button: 'right' })
        await ours.waitFor()
        await ours.getByRole('menuitem', { name: 'Pin to sidebar' }).click()
        await page.waitForFunction(() => [...document.querySelectorAll('.pinned a')].some((a) => a.textContent?.trim() === 'Ours'))
        await chip('Ours').click({ button: 'right' })
        await ours.getByRole('menuitem', { name: 'Unpin from sidebar' }).click()
        await page.waitForFunction(() => document.querySelectorAll('.pinned a').length === 0)
        assert.deepEqual(await pins(page), [], `${at}: unpinned`)

        // A preset pins and duplicates, and is never renamed or deleted;
        // a press outside shuts its menu.
        const all = opened('view All')
        await chip('All').click({ button: 'right' })
        await all.waitFor()
        assert.deepEqual(await all.getByRole('menuitem').allTextContents().then((ts) => ts.map((t) => t.trim())), ['Pin to sidebar', 'Duplicate'], `${at}: All pins and duplicates`)
        await page.locator('h1').first().click()
        await all.waitFor({ state: 'detached' })
        const before = new URL(page.url()).searchParams.get('v')
        await chip('All').click({ button: 'right' })
        await all.getByRole('menuitem', { name: 'Duplicate' }).click()
        await chip('Tasks copy').waitFor()
        await page.waitForURL((u) => (u.searchParams.get('v') ?? before) !== before)
        const copy = new URL(page.url()).searchParams.get('v')
        // Duplicate opens the copy.
        await bar.locator('a[aria-current="page"]', { hasText: 'Tasks copy' }).waitFor()

        // Delete: a view not open goes and the page stays; the open one
        // leaves for All.
        await chip('Ours').click({ button: 'right' })
        await ours.getByRole('menuitem', { name: 'Delete' }).click()
        await chip('Ours').waitFor({ state: 'detached' })
        assert.equal(new URL(page.url()).searchParams.get('v'), copy, `${at}: deleting another view leaves the open one open`)
        await chip('Tasks copy').click({ button: 'right' })
        await opened('view Tasks copy').getByRole('menuitem', { name: 'Delete' }).click()
        await page.waitForURL((u) => !u.searchParams.has('v'))
        assert.deepEqual(await icons(page), [], `${at}: none of hers is left`)
        assert.deepEqual(errors, [], `${at}: the pages threw nothing`)
        await context.close()
      }
    } finally {
      await browser.close()
      await stop()
    }
  })
})
