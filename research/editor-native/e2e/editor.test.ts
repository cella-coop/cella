import { after, before, beforeEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright-core'
import { createServer, type ViteDevServer } from 'vite'

// The editor in a real Chromium, driven as a person would: keys, clicks,
// IME composition over CDP. Needs PLAYWRIGHT_BROWSERS_PATH (nixpkgs'
// playwright-driver.browsers, matching playwright-core's version).

const shots = process.env.SHOTS ?? '/tmp/editor-native-shots'
const port = 5191

type Row = { id: string; depth: number; kind: string; props: Record<string, unknown>; text: string; runs: { text: string; marks?: Record<string, unknown> }[] }

let server: ViteDevServer
let browser: Browser
let context: BrowserContext
let page: Page

const sides = ['Ada', 'Bo'] as const

const rows = (side = 0): Promise<Row[]> => page.evaluate((i) => (window as any).__spike.rows(i), side)
const canon = (side: number): Promise<string> => page.evaluate((i) => (window as any).__spike.canon(i), side)
const row = (side: number, i: number) => page.locator(`[data-side=${sides[side]}] [data-row]`).nth(i)
const editable = (side: number, i: number) => row(side, i).locator('[contenteditable=true]')

// The caret's offset in the focused block, and that block's id.
const caret = (): Promise<{ id: string | undefined; offset: number }> =>
  page.evaluate(() => {
    const el = document.activeElement as HTMLElement
    const s = document.getSelection()!
    const r = document.createRange()
    r.setStart(el, 0)
    r.setEnd(s.focusNode!, s.focusOffset)
    return { id: el.dataset.block, offset: r.toString().length }
  })

async function settle() {
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0))))
}

async function converged() {
  await settle()
  assert.equal(await canon(1), await canon(0), 'the two sides read the same')
  assert.equal(await page.locator('[data-testid=converged]').textContent().then((t) => t?.trim()), 'Converged')
}

async function end(side: number, i: number) {
  await editable(side, i).click()
  await page.keyboard.press('Control+End')
}

async function start(side: number, i: number) {
  await editable(side, i).click()
  await page.keyboard.press('Control+Home')
}

before(async () => {
  mkdirSync(shots, { recursive: true })
  server = await createServer({
    configFile: new URL('../vite.config.ts', import.meta.url).pathname,
    server: { port, strictPort: true },
    logLevel: 'error',
  })
  await server.listen()
  browser = await chromium.launch()
  context = await browser.newContext({ viewport: { width: 1280, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] })
})

after(async () => {
  await browser?.close()
  await server?.close()
})

beforeEach(async () => {
  page?.close()
  page = await context.newPage()
  page.on('pageerror', (e) => {
    throw e
  })
  await page.goto(`http://localhost:${port}/`)
  await page.waitForSelector('[data-side=Bo] [data-row]')
})

describe('typing and blocks', () => {
  it('types into a block, and the other side receives it', async () => {
    await end(0, 1)
    await page.keyboard.type(' Done.')
    const r = await rows(0)
    assert.ok(r[1].text.endsWith('rate. Done.'), r[1].text)
    assert.equal(await editable(0, 1).textContent(), r[1].text, 'the DOM shows the model')
    await converged()
  })

  it('splits on Enter and merges on Backspace', async () => {
    await end(0, 0)
    await page.keyboard.press('ArrowLeft')
    await page.keyboard.press('ArrowLeft')
    await page.keyboard.press('Enter')
    let r = await rows(0)
    assert.equal(r[0].text, 'Rate card 20')
    assert.equal(r[1].text, '27')
    assert.equal(r[1].kind, 'paragraph', 'a heading continues as a paragraph')
    assert.deepEqual(await caret(), { id: r[1].id, offset: 0 })
    // Backspace at its start merges it back, the caret at the seam.
    await page.keyboard.press('Backspace')
    r = await rows(0)
    assert.equal(r[0].text, 'Rate card 2027')
    assert.deepEqual(await caret(), { id: r[0].id, offset: 12 })
    await converged()
  })

  it('turns a block by markdown shortcut', async () => {
    await end(0, 1)
    await page.keyboard.press('Enter')
    await page.keyboard.type('## Terms')
    await page.keyboard.press('Enter')
    await page.keyboard.type('- one')
    await page.keyboard.press('Enter')
    await page.keyboard.type('[] two')
    await page.keyboard.press('Enter')
    await page.keyboard.press('Enter')
    await page.keyboard.type('---')
    const r = await rows(0)
    assert.deepEqual(
      r.slice(2, 7).map((x) => [x.kind, x.text]),
      [
        ['heading', 'Terms'],
        ['bullet', 'one'],
        ['todo', 'two'],
        ['divider', ''],
        ['paragraph', ''],
      ],
    )
    assert.equal(r[2].props.level, 2)
    await converged()
  })

  it('turns a block from the slash menu, by keyboard', async () => {
    await end(0, 1)
    await page.keyboard.press('Enter')
    await page.keyboard.type('/quo')
    const menu = page.locator('[data-side=Ada] [role=listbox]')
    await menu.waitFor()
    assert.deepEqual(await menu.locator('[role=option] span:first-child').allTextContents(), ['Quote'])
    await page.keyboard.press('Enter')
    await page.keyboard.type('Said')
    const r = await rows(0)
    assert.equal(r[2].kind, 'quote')
    assert.equal(r[2].text, 'Said')
    assert.equal(await menu.count(), 0)
  })

  it('nests and unnests with Tab and Shift-Tab', async () => {
    await end(0, 7)
    await page.keyboard.press('Tab')
    let r = await rows(0)
    assert.equal(r[7].text, 'Brand identity — per project')
    assert.equal(r[7].depth, 1)
    assert.equal(r[8].depth, 2, 'its children come along')
    assert.deepEqual((await caret()).id, r[7].id, 'the caret stays in the block')
    await page.keyboard.press('Shift+Tab')
    r = await rows(0)
    assert.equal(r[7].depth, 0)
    await converged()
  })

  it('toggles bold for the next typed text', async () => {
    await end(0, 1)
    await page.keyboard.press('Control+b')
    await page.keyboard.type('Z')
    const r = await rows(0)
    assert.deepEqual(r[1].runs.at(-1), { text: 'Z', marks: { bold: true } })
  })

  it('merges the next block on Delete at the end', async () => {
    await end(0, 5)
    await page.keyboard.press('Delete')
    const r = await rows(0)
    assert.equal(r[5].text, 'Standard: 560 €Solidarity: 380 €')
    assert.equal(r[6].text, 'Brand identity — per project')
    await converged()
  })

  it('links a selection with Ctrl-K', async () => {
    page.once('dialog', (d) => d.accept('https://lanterne.example'))
    await start(0, 0)
    await page.keyboard.press('Shift+End')
    await page.keyboard.press('Control+k')
    const r = await rows(0)
    assert.deepEqual(r[0].runs, [{ text: 'Rate card 2027', marks: { link: 'https://lanterne.example' } }])
    assert.equal(await editable(0, 0).locator('a').getAttribute('href'), 'https://lanterne.example')
  })

  it('steps onto the decision embed as a whole, and past it', async () => {
    await end(0, 1)
    await page.keyboard.press('ArrowDown')
    const r = await rows(0)
    assert.equal(await page.locator('[data-side=Ada] .selected').getAttribute('data-row'), r[2].id)
    await page.keyboard.press('Enter')
    const after = await rows(0)
    assert.equal(after[3].kind, 'paragraph')
    assert.deepEqual(await caret(), { id: after[3].id, offset: 0 })
  })

  it('moves the caret across blocks with the arrows', async () => {
    await end(0, 0)
    await page.keyboard.press('ArrowRight')
    const r = await rows(0)
    assert.deepEqual(await caret(), { id: r[1].id, offset: 0 })
    await page.keyboard.press('ArrowLeft')
    assert.deepEqual(await caret(), { id: r[0].id, offset: 14 })
    await page.keyboard.press('ArrowDown')
    assert.equal((await caret()).id, r[1].id)
  })
})

describe('selection and structure', () => {
  it('selects blocks with Shift-arrows and deletes them', async () => {
    await end(0, 5)
    await page.keyboard.press('Shift+ArrowDown')
    assert.equal(await page.locator('[data-side=Ada] .selected').count(), 2)
    await page.screenshot({ path: `${shots}/block-selection.png`, clip: { x: 0, y: 0, width: 1280, height: 620 } })
    await page.keyboard.press('Backspace')
    const r = await rows(0)
    assert.equal(r.length, 25)
    assert.equal(r[4].text, 'Day of work — per day')
    assert.equal(r[5].text, 'Brand identity — per project')
    await converged()
  })

  it('selects by dragging across blocks', async () => {
    const a = await editable(0, 4).boundingBox()
    const b = await editable(0, 6).boundingBox()
    await page.mouse.move(a!.x + 10, a!.y + 5)
    await page.mouse.down()
    await page.mouse.move(b!.x + 20, b!.y + 5, { steps: 8 })
    await page.mouse.up()
    assert.equal(await page.locator('[data-side=Ada] .selected').count(), 3)
  })

  it('moves a selected block with Alt-Shift-arrows', async () => {
    await row(0, 2).click()
    await page.keyboard.press('Alt+Shift+ArrowDown')
    const r = await rows(0)
    assert.equal(r[2].kind, 'heading')
    assert.equal(r[3].kind, 'decision')
    await converged()
  })

  it('reorders by the drag handle, and nests by dropping to the right', async () => {
    const drag = async (from: number, to: number, x: number, y: number) => {
      await row(0, from).hover()
      const h = (await row(0, from).locator('[data-handle]').boundingBox())!
      const t = (await row(0, to).boundingBox())!
      await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2)
      await page.mouse.down()
      await page.mouse.move(t.x + x, t.y + y, { steps: 6 })
      await page.mouse.up()
    }
    // Brand identity, with its children, before Day of work.
    await drag(7, 4, 60, 3)
    let r = await rows(0)
    assert.deepEqual(
      r.slice(4, 8).map((x) => [x.depth, x.text]),
      [
        [0, 'Brand identity — per project'],
        [1, 'Standard: from 6 500 €'],
        [1, 'Solidarity: from 3 300 €'],
        [0, 'Day of work — per day'],
      ],
    )
    // Website into Day of work, as its first child.
    const box = (await row(0, 7).boundingBox())!
    await drag(10, 7, box.width - 40, box.height - 4)
    r = await rows(0)
    assert.deepEqual(
      r.slice(7, 9).map((x) => [x.depth, x.text]),
      [
        [0, 'Day of work — per day'],
        [1, 'Website — per project'],
      ],
    )
    await converged()
  })

  it('copies blocks and pastes them elsewhere', async () => {
    await row(0, 22).locator('[data-handle]').click({ force: true })
    await page.keyboard.press('Control+c')
    await end(0, 0)
    await page.keyboard.press('Control+v')
    const r = await rows(0)
    assert.equal(r[1].kind, 'todo')
    assert.equal(r[1].text, 'Decide whether existing retainers keep the 2026 rate')
    assert.equal(r.length, 28)
  })

  it('pastes plain text from outside as paragraphs', async () => {
    await end(0, 0)
    await page.evaluate(() => navigator.clipboard.writeText('one\ntwo'))
    await page.keyboard.press('Control+v')
    const r = await rows(0)
    assert.equal(r[0].text, 'Rate card 2027one')
    assert.equal(r[1].text, 'two')
    assert.deepEqual(await caret(), { id: r[1].id, offset: 3 })
  })
})

describe('composition and collaboration', () => {
  it('commits an IME composition as one insert', async () => {
    await end(0, 0)
    const cdp = await context.newCDPSession(page)
    await cdp.send('Input.imeSetComposition', { text: 'n', selectionStart: 1, selectionEnd: 1 })
    await cdp.send('Input.imeSetComposition', { text: 'ni', selectionStart: 2, selectionEnd: 2 })
    await cdp.send('Input.imeSetComposition', { text: '你', selectionStart: 1, selectionEnd: 1 })
    let r = await rows(0)
    assert.equal(r[0].text, 'Rate card 2027', 'nothing reaches Loro mid-composition')
    await cdp.send('Input.insertText', { text: '你好' })
    await settle()
    r = await rows(0)
    assert.equal(r[0].text, 'Rate card 2027你好')
    assert.equal(await editable(0, 0).textContent(), 'Rate card 2027你好')
    assert.deepEqual(await caret(), { id: r[0].id, offset: 16 })
    await page.keyboard.type('!')
    r = await rows(0)
    assert.equal(r[0].text, 'Rate card 2027你好!')
    await converged()
  })

  it('keeps the caret in place when the other side edits the same block', async () => {
    await start(0, 1)
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('ArrowRight')
    }
    const id = (await rows(0))[1].id
    assert.deepEqual(await caret(), { id, offset: 4 })
    // Bo types before Ada's caret, and after it.
    await page.evaluate((id) => {
      const doc = (window as any).__spike.pair.docs[1]
      const t = doc.getTree('blocks').getNodeByID(id).data.get('text')
      t.insert(0, 'NB: ')
      t.insert(t.length, ' (draft)')
      doc.commit()
    }, id)
    await settle()
    assert.deepEqual(await caret(), { id, offset: 8 }, 'the caret moved with the text before it')
    await page.keyboard.type('X')
    const r = await rows(0)
    assert.ok(r[1].text.startsWith('NB: Day X'), r[1].text)
    assert.ok(r[1].text.endsWith(' (draft)'))
    await converged()
  })

  it('keeps typing contiguous while the other side types in the same block', async () => {
    await end(0, 0)
    const id = (await rows(0))[0].id
    for (const ch of 'abcdef') {
      await page.evaluate((id) => {
        const doc = (window as any).__spike.pair.docs[1]
        doc.getTree('blocks').getNodeByID(id).data.get('text').insert(0, '~')
        doc.commit()
      }, id)
      await page.keyboard.type(ch)
    }
    await settle()
    assert.equal((await rows(0))[0].text, '~~~~~~Rate card 2027abcdef')
    assert.deepEqual(await caret(), { id, offset: 26 })
    await converged()
  })

  it('undoes its own edits only', async () => {
    await end(0, 0)
    await page.keyboard.type(' A')
    const id = (await rows(0))[4].id
    await page.evaluate((id) => {
      const doc = (window as any).__spike.pair.docs[1]
      doc.getTree('blocks').getNodeByID(id).data.get('text').insert(0, 'B ')
      doc.commit()
    }, id)
    await settle()
    await page.keyboard.press('Control+z')
    await settle()
    const r = await rows(0)
    assert.equal(r[0].text, 'Rate card 2027')
    assert.equal(r[4].text, 'B Day of work — per day')
    await page.keyboard.press('Control+Shift+z')
    assert.equal((await rows(0))[0].text, 'Rate card 2027 A')
    await converged()
  })

  it('queues edits offline and converges on reconnect', async () => {
    await page.locator('[data-testid=online]').uncheck()
    await end(0, 0)
    await page.keyboard.type(' one')
    await end(1, 0)
    await page.keyboard.type(' two')
    await settle()
    assert.equal(await page.locator('[data-testid=converged]').textContent().then((t) => t?.trim()), 'Diverged')
    await page.locator('[data-testid=online]').check()
    await settle()
    const text = (await rows(0))[0].text
    assert.ok(text === 'Rate card 2027 one two' || text === 'Rate card 2027 two one', text)
    await converged()
  })
})

describe('screenshots', () => {
  it('captures the editor in light and dark', async () => {
    await end(0, 1)
    await page.keyboard.press('Enter')
    await page.keyboard.type('/')
    await page.locator('[role=listbox]').waitFor()
    await page.screenshot({ path: `${shots}/slash-light.png`, clip: { x: 0, y: 0, width: 1280, height: 700 } })
    await page.keyboard.press('Escape')
    await page.keyboard.press('Backspace')
    await page.keyboard.press('Backspace')
    await start(0, 1)
    await page.keyboard.press('Shift+End')
    await settle()
    await page.screenshot({ path: `${shots}/toolbar-light.png`, clip: { x: 0, y: 0, width: 1280, height: 500 } })
    await page.emulateMedia({ colorScheme: 'light' })
    await page.screenshot({ path: `${shots}/light.png`, fullPage: true })
    await page.emulateMedia({ colorScheme: 'dark' })
    await settle()
    await page.screenshot({ path: `${shots}/dark.png`, fullPage: true })
    await row(0, 22).click()
    await page.screenshot({ path: `${shots}/dark-detail.png`, clip: { x: 0, y: 380, width: 1280, height: 520 } })
  })
})
