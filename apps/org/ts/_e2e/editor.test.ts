// The block editor in real browsers, Chromium, Firefox and WebKit, driven as
// a person does: keys, clicks, drags, the clipboard, composition. Two tabs
// are two members' devices on one document, syncing through the shell's
// server: their edits go up as signed writes and come back on the
// document's stream. Each test edits a fresh copy of the 2027 rate card.
// Then a fuzzer drives random keys, compositions and remote edits through
// the editor and checks that the page shows the model and the two tabs
// converge. Run by `cella test e2e editor`, on the built shell.

import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import pg from 'pg'
import type { Browser, BrowserContext, Page } from 'playwright-core'
import { createDoc, edits, type Fragment, type Run } from '@cella/org-document/models'
import { browsers, serve, signIn } from './browser.ts'

const shots = process.env.SHOTS ?? '/tmp/cella-editor-shots'
const camille = 'camille@lanterne.example'
const su = new pg.Client()
let base = ''
let stop = async () => {}
let made = 0

type Row = { id: string; depth: number; kind: string; props: Record<string, unknown>; text: string; runs: Run[] }

const p = (...rs: (string | Run)[]): Run[] => rs.map((r) => (typeof r === 'string' ? { text: r } : r))
const b = (t: string): Run => ({ text: t, marks: { bold: true } })
const service = (name: string, unit: string, standard: string, solidarity: string): Fragment => ({
  type: 'bullet',
  runs: p(b(name), ` — per ${unit}`),
  children: [
    { type: 'bullet', runs: p(`Standard: ${standard}`), children: [] },
    { type: 'bullet', runs: p(`Solidarity: ${solidarity}`), children: [] },
  ],
})

// The rate card as the spike's tests know it: 27 blocks, the embed third,
// the services from the fifth.
const card: Fragment[] = [
  { type: 'heading', level: 1, runs: p('Rate card 2027'), children: [] },
  { type: 'paragraph', runs: p('Day rates and project floors for ', { text: '2027', marks: { italic: true } }, '. Small co-ops pay the ', b('solidarity'), ' rate.'), children: [] },
  { type: 'embed', embed: 'motion', ref: 'm-2026-011', runs: [], children: [] },
  { type: 'heading', level: 2, runs: p('Services'), children: [] },
  service('Day of work', 'day', '560 €', '380 €'),
  service('Brand identity', 'project', 'from 6 500 €', 'from 3 300 €'),
  service('Website', 'project', 'from 12 000 €', 'from 7 500 €'),
  service('Online shop', 'project', 'from 9 500 €', 'from 6 000 €'),
  service('Marketing retainer', 'month', 'from 4 800 €', 'from 2 400 €'),
  { type: 'divider', runs: [], children: [] },
  { type: 'heading', level: 2, runs: p('Open questions'), children: [] },
  { type: 'quote', runs: p('Nuvola renews in January at the current rate; do we hold it? — malik'), children: [] },
  { type: 'todo', checked: false, runs: p('Decide whether existing retainers keep the 2026 rate'), children: [] },
  { type: 'todo', checked: true, runs: p('Add the ', { text: 'Online shop', marks: { code: true } }, ' line'), children: [] },
  { type: 'numbered', runs: p('Coordination proposes'), children: [] },
  { type: 'numbered', runs: p('The general meeting ', { text: 'decides', marks: { link: 'https://corpus.pub' } }), children: [] },
  { type: 'code', language: 'toml', runs: p('[rate]\nday = 560'), children: [] },
]

// A fresh document holding the card, carried over as one update.
async function fresh(): Promise<string> {
  const id = `card-${++made}`
  const doc = createDoc(1n)
  edits.paste(doc, undefined, 0, card)
  doc.commit()
  await su.query('INSERT INTO document.document (id, title) VALUES ($1, $2)', [id, `Card ${made}`])
  await su.query(`INSERT INTO document.update (receipt, document, author, at, bytes) VALUES (nextval('cella.receipt_seq'), $1, NULL, '2026-10-24', $2)`, [
    id,
    doc.export({ mode: 'update' }),
  ])
  return id
}

before(async () => {
  mkdirSync(shots, { recursive: true })
  await su.connect()
  // The host carries documents in around the notary, as only a superuser may.
  await su.query('SET cella.unbound = on')
  ;({ base, stop } = await serve())
})

after(async () => {
  await stop()
  await su.end()
})

for (const [name, launch] of browsers()) {
  describe(name, () => {
    let browser: Browser
    let context: BrowserContext
    let a: Page
    let bo: Page
    // What the pages threw, which fails the test it happens in.
    const errors: string[] = []
    const clean = () => assert.deepEqual(errors.splice(0), [], 'the pages threw nothing')

    // The editor's state, read from its element.
    const rows = (page: Page = a): Promise<Row[]> =>
      page.evaluate(() => {
        const ed = (document.querySelector('[data-editor]') as any).cellaEditor
        return ed.rows.map((v: any) => {
          const t = ed.doc.getTree('blocks').getNodeByID(v.id).data.get('text')
          const runs = t.toDelta().map((d: any) => {
            const marks = Object.fromEntries(Object.entries(d.attributes ?? {}).filter(([, x]) => x !== null && x !== false))
            return Object.keys(marks).length ? { text: d.insert, marks } : { text: d.insert }
          })
          return { id: v.id, depth: v.depth, kind: v.kind, props: v.props, text: t.toString(), runs }
        })
      })
    const line = (i: number, page: Page = a) => page.locator('[data-editor] .line').nth(i)
    const editable = (i: number, page: Page = a) => line(i, page).locator('[contenteditable=true]')

    const caret = (page: Page = a): Promise<{ id: string | undefined; offset: number }> =>
      page.evaluate(() => {
        const el = document.activeElement as HTMLElement
        const s = document.getSelection()!
        const r = document.createRange()
        r.setStart(el, 0)
        r.setEnd(s.focusNode!, s.focusOffset)
        return { id: el.dataset.block, offset: r.toString().length }
      })

    const settle = (page: Page = a) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0))))

    // Waits until a condition on a tab's rows holds, as edits travel.
    async function until(test: (r: Row[]) => boolean, page: Page = a, what = 'the rows') {
      for (let i = 0; i < 100; i++) {
        if (test(await rows(page))) {
          return
        }
        await page.waitForTimeout(100)
      }
      assert.fail(`${what} never came: ${JSON.stringify((await rows(page)).map((r) => r.text))}`)
    }

    // Both tabs saved everything and read the same, by the canonical hash
    // each previews.
    async function converged() {
      let last: string[] = []
      for (let i = 0; i < 100; i++) {
        const states = await Promise.all([a, bo].map((pg) => pg.locator('[data-state]').evaluate((el) => [el.getAttribute('data-state'), el.getAttribute('data-hash')])))
        last = states.flat() as string[]
        if (states[0][0] === 'saved' && states[1][0] === 'saved' && states[0][1] === states[1][1]) {
          const canon = (pg: Page) => pg.evaluate(() => JSON.stringify((document.querySelector('[data-editor]') as any).cellaEditor.rows.length))
          assert.equal(await canon(a), await canon(bo))
          clean()
          return
        }
        await a.waitForTimeout(100)
      }
      assert.fail(`the tabs never converged: ${last.join(' ')}`)
    }

    // The DOM shows the model: each editable's text is its block's.
    async function shows(page: Page = a) {
      const out = await page.evaluate(() => {
        const ed = (document.querySelector('[data-editor]') as any).cellaEditor
        const wrong: string[] = []
        for (const el of document.querySelectorAll<HTMLElement>('[data-editor] [data-block]')) {
          const t = ed.doc.getTree('blocks').getNodeByID(el.dataset.block).data.get('text').toString()
          if ((el.textContent ?? '') !== t) {
            wrong.push(`${JSON.stringify(el.textContent)} ≠ ${JSON.stringify(t)}`)
          }
        }
        return wrong
      })
      assert.deepEqual(out, [], 'the page shows the model')
      clean()
    }

    // Remote edits, made in the other tab's document and sent as its
    // member's writes.
    const remote = (fn: string, arg: unknown) =>
      bo.evaluate(
        ([src, x]) => {
          const ed = (document.querySelector('[data-editor]') as any).cellaEditor
          new Function('doc', 'x', src)(ed.doc, x)
          ed.doc.commit()
        },
        [fn, arg] as const,
      )

    async function end(i: number, page: Page = a) {
      await editable(i, page).click()
      await page.keyboard.press('Control+End')
    }

    async function home(i: number, page: Page = a) {
      await editable(i, page).click()
      await page.keyboard.press('Control+Home')
    }

    async function open(page: Page, id: string) {
      page.on('pageerror', (e) => errors.push(`${e.message}\n${e.stack}`))
      await page.goto(`${base}/documents/${id}`)
      await page.waitForSelector('[data-editor] [data-block]')
      await page.waitForSelector('[data-sync=live]')
    }

    async function fresher() {
      const id = await fresh()
      await a?.close()
      await bo?.close()
      a = await context.newPage()
      bo = await context.newPage()
      await open(a, id)
      await open(bo, id)
    }

    before(async () => {
      browser = await launch()
      context = await browser.newContext({ viewport: { width: 1280, height: 900 }, extraHTTPHeaders: { 'x-forwarded-proto': 'http' } })
      await signIn(context, base, camille)
    })

    after(async () => {
      await browser?.close()
    })

    describe('typing and blocks', () => {
      it('types into a block, and the other tab receives it', async () => {
        await fresher()
        await end(1)
        await a.keyboard.type(' Done.')
        const r = await rows()
        assert.ok(r[1].text.endsWith('rate. Done.'), r[1].text)
        await shows()
        await until((x) => x[1].text.endsWith('rate. Done.'), bo, 'the edit in the other tab')
        await converged()
      })

      it('splits on Enter and merges on Backspace', async () => {
        await fresher()
        await end(0)
        await a.keyboard.press('ArrowLeft')
        await a.keyboard.press('ArrowLeft')
        await a.keyboard.press('Enter')
        let r = await rows()
        assert.equal(r[0].text, 'Rate card 20')
        assert.equal(r[1].text, '27')
        assert.equal(r[1].kind, 'paragraph', 'a heading continues as a paragraph')
        assert.deepEqual(await caret(), { id: r[1].id, offset: 0 })
        await a.keyboard.press('Backspace')
        r = await rows()
        assert.equal(r[0].text, 'Rate card 2027')
        assert.deepEqual(await caret(), { id: r[0].id, offset: 12 })
        await converged()
      })

      it('turns a block by markdown shortcut', async () => {
        await fresher()
        await end(1)
        await a.keyboard.press('Enter')
        await a.keyboard.type('## Terms')
        await a.keyboard.press('Enter')
        await a.keyboard.type('- one')
        await a.keyboard.press('Enter')
        await a.keyboard.type('[] two')
        await a.keyboard.press('Enter')
        await a.keyboard.press('Enter')
        await a.keyboard.type('---')
        const r = await rows()
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
        await shows()
        await converged()
      })

      it('turns a block from the slash menu, by keyboard', async () => {
        await fresher()
        await end(1)
        await a.keyboard.press('Enter')
        await a.keyboard.type('/quo')
        const menu = a.locator('[role=listbox][aria-label="Turn into"]')
        await menu.waitFor()
        assert.deepEqual(await menu.locator('[role=option] span:first-child').allTextContents(), ['Quote'])
        await a.keyboard.press('Enter')
        await a.keyboard.type('Said')
        const r = await rows()
        assert.equal(r[2].kind, 'quote')
        assert.equal(r[2].text, 'Said')
        assert.equal(await menu.count(), 0)
      })

      it('embeds a motion from the slash menu, which the graft draws', async () => {
        await fresher()
        await end(1)
        await a.keyboard.press('Enter')
        await a.keyboard.type('/m-2026-007')
        const menu = a.locator('[role=listbox][aria-label="Turn into"]')
        await menu.waitFor()
        await a.keyboard.press('Enter')
        const r = await rows()
        assert.equal(r[2].kind, 'embed')
        assert.deepEqual(r[2].props, { embed: 'motion', ref: 'm-2026-007' })
        assert.match((await line(2).textContent()) ?? '', /Adopt the internal rules, version 3/)
        await converged()
      })

      it('nests and unnests with Tab and Shift-Tab', async () => {
        await fresher()
        await end(7)
        await a.keyboard.press('Tab')
        let r = await rows()
        assert.equal(r[7].text, 'Brand identity — per project')
        assert.equal(r[7].depth, 1)
        assert.equal(r[8].depth, 2, 'its children come along')
        assert.equal((await caret()).id, r[7].id, 'the caret stays in the block')
        await a.keyboard.press('Shift+Tab')
        r = await rows()
        assert.equal(r[7].depth, 0)
        await converged()
      })

      it('toggles bold for the next typed text', async () => {
        await fresher()
        await end(1)
        await a.keyboard.press('Control+b')
        await a.keyboard.type('Z')
        const r = await rows()
        assert.deepEqual(r[1].runs.at(-1), { text: 'Z', marks: { bold: true } })
      })

      it('merges the next block on Delete at the end', async () => {
        await fresher()
        await end(5)
        await a.keyboard.press('Delete')
        const r = await rows()
        assert.equal(r[5].text, 'Standard: 560 €Solidarity: 380 €')
        assert.equal(r[6].text, 'Brand identity — per project')
        await converged()
      })

      it('links a selection with Ctrl-K, in the popover', async () => {
        await fresher()
        await home(0)
        await a.keyboard.press('Shift+End')
        await a.keyboard.press('Control+k')
        const field = a.locator('[data-href] input')
        await field.waitFor({ state: 'visible' })
        await field.fill('https://lanterne.example')
        await field.press('Enter')
        await until((x) => x[0].runs[0]?.marks?.link === 'https://lanterne.example')
        assert.deepEqual((await rows())[0].runs, [{ text: 'Rate card 2027', marks: { link: 'https://lanterne.example' } }])
        assert.equal(await editable(0).locator('a').getAttribute('href'), 'https://lanterne.example')
      })

      it('steps onto the motion embed as a whole, and past it', async () => {
        await fresher()
        await end(1)
        await a.keyboard.press('ArrowDown')
        const r = await rows()
        assert.equal(await a.locator('[data-editor] [data-selected]').getAttribute('data-row'), r[2].id)
        await a.keyboard.press('Enter')
        const after = await rows()
        assert.equal(after[3].kind, 'paragraph')
        assert.deepEqual(await caret(), { id: after[3].id, offset: 0 })
      })

      it('moves the caret across blocks with the arrows', async () => {
        await fresher()
        await end(0)
        await a.keyboard.press('ArrowRight')
        const r = await rows()
        assert.deepEqual(await caret(), { id: r[1].id, offset: 0 })
        await a.keyboard.press('ArrowLeft')
        assert.deepEqual(await caret(), { id: r[0].id, offset: 14 })
        await a.keyboard.press('ArrowDown')
        assert.equal((await caret()).id, r[1].id)
      })
    })

    describe('choosing blocks and structure', () => {
      it('chooses blocks with Shift-arrows and deletes them', async () => {
        await fresher()
        await end(5)
        await a.keyboard.press('Shift+ArrowDown')
        assert.equal(await a.locator('[data-editor] [data-selected]').count(), 2)
        await a.screenshot({ path: `${shots}/${name}-chosen.png` })
        await a.keyboard.press('Backspace')
        const r = await rows()
        assert.equal(r.length, 25)
        assert.equal(r[4].text, 'Day of work — per day')
        assert.equal(r[5].text, 'Brand identity — per project')
        await converged()
      })

      it('chooses blocks by dragging across them', async () => {
        await fresher()
        const from = (await editable(4).boundingBox())!
        const to = (await editable(6).boundingBox())!
        await a.mouse.move(from.x + 10, from.y + 5)
        await a.mouse.down()
        await a.mouse.move(to.x + 20, to.y + 5, { steps: 8 })
        await a.mouse.up()
        assert.equal(await a.locator('[data-editor] [data-selected]').count(), 3)
      })

      it('moves a chosen block with Alt-Shift-arrows', async () => {
        await fresher()
        await line(2).locator('.embed .kind').click()
        await a.keyboard.press('Alt+Shift+ArrowDown')
        const r = await rows()
        assert.equal(r[2].kind, 'heading')
        assert.equal(r[3].kind, 'embed')
        await converged()
      })

      it('reorders by the grip, by pointer and by keyboard', async () => {
        await fresher()
        // Brand identity, with its children, before Day of work.
        await line(7).hover()
        const grip = (await line(7).locator('[data-drag-handle]').boundingBox())!
        const target = (await line(4).boundingBox())!
        await a.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2)
        await a.mouse.down()
        await a.mouse.move(target.x + 60, target.y + 2, { steps: 8 })
        await a.mouse.up()
        let r = await rows()
        assert.deepEqual(
          r.slice(4, 8).map((x) => [x.depth, x.text]),
          [
            [0, 'Brand identity — per project'],
            [1, 'Standard: from 6 500 €'],
            [1, 'Solidarity: from 3 300 €'],
            [0, 'Day of work — per day'],
          ],
        )
        // The code block up past the numbered items, from the keyboard.
        await line(26).locator('[data-drag-handle]').focus()
        await a.keyboard.press('Space')
        await a.keyboard.press('ArrowUp')
        await a.keyboard.press('ArrowUp')
        await a.keyboard.press('Space')
        r = await rows()
        assert.deepEqual(
          r.slice(24, 27).map((x) => x.kind),
          ['code', 'numbered', 'numbered'],
        )
        await converged()
      })

      it('copies blocks and pastes them elsewhere', async () => {
        await fresher()
        await line(22).hover()
        await line(22).locator('[data-drag-handle]').click()
        assert.equal(await a.locator('[data-editor] [data-selected]').count(), 1)
        await a.keyboard.press('Control+c')
        await end(0)
        await a.keyboard.press('Control+v')
        const r = await rows()
        assert.equal(r[1].kind, 'todo')
        assert.equal(r[1].text, 'Decide whether existing retainers keep the 2026 rate')
        assert.equal(r.length, 28)
        await converged()
      })

      it('copies a range of text with its marks, and pastes it in another block', async () => {
        await fresher()
        await editable(1).click()
        // "solidarity", bold, from its start to its end.
        const at = (await rows())[1].text.indexOf('solidarity')
        await a.keyboard.press('Control+Home')
        for (let i = 0; i < at; i++) {
          await a.keyboard.press('ArrowRight')
        }
        for (let i = 0; i < 'solidarity'.length; i++) {
          await a.keyboard.press('Shift+ArrowRight')
        }
        await a.keyboard.press('Control+c')
        await end(0)
        await a.keyboard.press('Control+v')
        const r = await rows()
        assert.equal(r[0].text, 'Rate card 2027solidarity')
        assert.deepEqual(r[0].runs.at(-1), { text: 'solidarity', marks: { bold: true } })
        await converged()
      })

      it('pastes plain text from outside as paragraphs', async () => {
        await fresher()
        // Copied from a text area outside the editor, as from another app.
        await a.evaluate(() => {
          const area = document.createElement('textarea')
          area.id = 'outside'
          area.value = 'one\ntwo'
          document.body.append(area)
        })
        await a.locator('#outside').focus()
        await a.keyboard.press('Control+a')
        await a.keyboard.press('Control+c')
        await end(0)
        await a.keyboard.press('Control+v')
        const r = await rows()
        assert.equal(r[0].text, 'Rate card 2027one')
        assert.equal(r[1].text, 'two')
        assert.deepEqual(await caret(), { id: r[1].id, offset: 3 })
      })
    })

    describe('composition, collaboration and repair', () => {
      it('commits an IME composition as one insert', async () => {
        await fresher()
        await end(0)
        if (name === 'chromium') {
          const cdp = await context.newCDPSession(a)
          await cdp.send('Input.imeSetComposition', { text: 'n', selectionStart: 1, selectionEnd: 1 })
          await cdp.send('Input.imeSetComposition', { text: 'ni', selectionStart: 2, selectionEnd: 2 })
          await cdp.send('Input.imeSetComposition', { text: '你', selectionStart: 1, selectionEnd: 1 })
          assert.equal((await rows())[0].text, 'Rate card 2027', 'nothing reaches Loro mid-composition')
          await cdp.send('Input.insertText', { text: '你好' })
        } else {
          // No IME to drive here: the events an IME fires, with the text it
          // draws into the block meanwhile.
          await a.evaluate(() => {
            const el = document.activeElement as HTMLElement
            el.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: '' }))
            el.append(document.createTextNode('ni'))
          })
          assert.equal((await rows())[0].text, 'Rate card 2027', 'nothing reaches Loro mid-composition')
          await a.evaluate(() => {
            document.activeElement!.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '你好' }))
          })
        }
        await settle()
        let r = await rows()
        assert.equal(r[0].text, 'Rate card 2027你好')
        assert.equal(await editable(0).textContent(), 'Rate card 2027你好')
        assert.deepEqual(await caret(), { id: r[0].id, offset: 16 })
        await a.keyboard.type('!')
        r = await rows()
        assert.equal(r[0].text, 'Rate card 2027你好!')
        await converged()
      })

      it('keeps the caret in place when the other tab edits the same block', async () => {
        await fresher()
        await home(1)
        for (let i = 0; i < 4; i++) {
          await a.keyboard.press('ArrowRight')
        }
        const id = (await rows())[1].id
        assert.deepEqual(await caret(), { id, offset: 4 })
        await remote(`const t = doc.getTree('blocks').getNodeByID(x).data.get('text'); t.insert(0, 'NB: '); t.insert(t.length, ' (draft)')`, id)
        await until((r) => r[1].text.startsWith('NB: '))
        await settle()
        assert.deepEqual(await caret(), { id, offset: 8 }, 'the caret moved with the text before it')
        await a.keyboard.type('X')
        const r = await rows()
        assert.ok(r[1].text.startsWith('NB: Day X'), r[1].text)
        assert.ok(r[1].text.endsWith(' (draft)'))
        await converged()
      })

      it('keeps typing contiguous while the other tab types in the same block', async () => {
        await fresher()
        await end(0)
        const id = (await rows())[0].id
        for (const ch of 'abcdef') {
          await remote(`doc.getTree('blocks').getNodeByID(x).data.get('text').insert(0, '~')`, id)
          await a.keyboard.type(ch)
          await a.waitForTimeout(60)
        }
        await until((r) => r[0].text === '~~~~~~Rate card 2027abcdef')
        await settle()
        assert.deepEqual(await caret(), { id, offset: 26 })
        await converged()
      })

      it('undoes its own edits only', async () => {
        await fresher()
        await end(0)
        await a.keyboard.type(' A')
        const id = (await rows())[4].id
        await remote(`doc.getTree('blocks').getNodeByID(x).data.get('text').insert(0, 'B ')`, id)
        await until((r) => r[4].text.startsWith('B '))
        await editable(0).click()
        await a.keyboard.press('Control+z')
        await settle()
        let r = await rows()
        assert.equal(r[0].text, 'Rate card 2027')
        assert.equal(r[4].text, 'B Day of work — per day')
        await a.keyboard.press('Control+Shift+z')
        r = await rows()
        assert.equal(r[0].text, 'Rate card 2027 A')
        await converged()
      })

      it('holds edits offline and converges on reconnecting', async () => {
        await fresher()
        await context.setOffline(true)
        await end(0)
        await a.keyboard.type(' one')
        await end(0, bo)
        await bo.keyboard.type(' two')
        await a.waitForTimeout(600)
        assert.match((await a.locator('[data-state]').getAttribute('data-state')) ?? '', /^(offline|saving)/)
        await context.setOffline(false)
        await until((r) => r[0].text.length === 'Rate card 2027 one two'.length, a, 'both edits in the first tab')
        await until((r) => r[0].text.length === 'Rate card 2027 one two'.length, bo, 'both edits in the second tab')
        const text = (await rows())[0].text
        assert.ok(text === 'Rate card 2027 one two' || text === 'Rate card 2027 two one', text)
        await converged()
      })

      it('paints a block again when something else changes its text', async () => {
        await fresher()
        await a.evaluate(() => {
          const el = document.querySelectorAll<HTMLElement>('[data-editor] [data-block]')[1]
          el.firstChild!.textContent = 'rewritten by an extension'
        })
        await settle()
        await shows()
        assert.ok(((await editable(1).textContent()) ?? '').startsWith('Day rates'))
      })

      it('survives random keys, compositions and remote edits, the page showing the model and the tabs converging', async () => {
        await fresher()
        const seed = Number(process.env.FUZZ_SEED ?? 1) + made
        let s = seed >>> 0
        const next = () => {
          s = (s + 0x6d2b79f5) >>> 0
          let t = s
          t = Math.imul(t ^ (t >>> 15), t | 1)
          t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
          return ((t ^ (t >>> 14)) >>> 0) / 4294967296
        }
        const pick = <T>(xs: readonly T[]): T => xs[Math.floor(next() * xs.length)]
        const keys = ['a', 'é', ' ', '😀', 'Enter', 'Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'Tab', 'Shift+Tab', 'Control+b', 'Shift+ArrowLeft', 'Escape'] as const
        const steps = Number(process.env.FUZZ_STEPS ?? 160)
        await end(1)
        for (let i = 0; i < steps; i++) {
          const roll = next()
          if (roll < 0.08) {
            // A remote edit at a random block's start.
            const r = await rows(bo)
            const id = pick(r.filter((x) => x.kind !== 'embed' && x.kind !== 'divider')).id
            await remote(`doc.getTree('blocks').getNodeByID(x).data.get('text').insert(0, 'r')`, id)
          } else if (roll < 0.12) {
            // A composition, as an IME ends one.
            await a.evaluate(() => {
              const el = document.activeElement as HTMLElement
              if (el?.dataset.block) {
                el.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: '' }))
                el.append(document.createTextNode('か'))
                el.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '漢' }))
              }
            })
          } else {
            const key = pick(keys)
            if (key === 'Escape') {
              // Choosing a block whole, then back into text with an arrow.
              await a.keyboard.press('Escape')
              await a.keyboard.press(pick(['ArrowDown', 'ArrowUp']))
            } else if (key.length <= 2 && !key.includes('+')) {
              await a.keyboard.type(key)
            } else {
              await a.keyboard.press(key)
            }
          }
          if (!(await a.evaluate(() => (document.activeElement as HTMLElement)?.dataset.block !== undefined))) {
            const all = await a.locator('[data-editor] [data-block]').count()
            await a.locator('[data-editor] [data-block]').nth(Math.floor(next() * all)).click()
          }
          if (i % 20 === 19) {
            await settle()
            await shows()
          }
        }
        await settle()
        await shows()
        await converged()
        await shows(bo)
        await a.screenshot({ path: `${shots}/${name}-fuzzed.png`, fullPage: true })
      })
    })

    describe('pages', () => {
      it('shows the rate card, and the version a motion adopts', async () => {
        const page = await context.newPage()
        await page.goto(`${base}/documents/rate-card-2027`)
        await page.waitForSelector('[data-editor] [data-block]')
        await page.screenshot({ path: `${shots}/${name}-rate-card.png`, fullPage: true })
        await page.goto(`${base}/motions/m-2026-011`)
        const text = (await page.locator('main, body').first().textContent()) ?? ''
        assert.match(text, /rate-card-2027@2/)
        assert.match(text, /Online shop/)
        await page.screenshot({ path: `${shots}/${name}-motion.png`, fullPage: true })
        await page.close()
      })
    })
  })
}
