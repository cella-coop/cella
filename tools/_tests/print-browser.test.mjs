// The print in real browsers: Chromium, Firefox and WebKit lay what
// print.css and the core make, the <cella-print> element at run time and
// a .cella-print over printFile()'s PNGs at build time, and each paints
// the explorer's printInto() of the fixture picture (brand.test.mjs says
// how it was captured). A second page widens a <cella-print> printed
// narrower and one laid out at zero width, and swaps a third's src for a
// missing file. The element's TypeScript is served as the browser asks
// for it, its types stripped, and print.css is made for the explorer's
// own settings, brand/explorer-house.json, as brand.test.mjs holds the
// port, since the house's inks have grown past the explorer's.
// `BROWSERS` (comma-separated) narrows the browsers run.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium, firefox, webkit } from 'playwright-core'
import ts from 'typescript'
import { printCss, printMarkup, PRINT_STYLES, resolve } from '../../packages/brand/src/index.ts'
import { dataUrl, printFile } from '../../packages/brand/src/print-file.ts'

const brand = new URL('../../packages/brand/', import.meta.url).pathname
const sharp = createRequire(join(brand, 'package.json'))('sharp')
const printed = JSON.parse(readFileSync(new URL('brand/explorer-print.json', import.meta.url), 'utf8'))
const { width, height } = printed
const css = printCss(resolve(JSON.parse(readFileSync(new URL('brand/explorer-house.json', import.meta.url), 'utf8'))))
const want = (style, ink) => Buffer.from(printed.prints.find((c) => c.style === style && c.ink === ink && c.scale === 1).rgb, 'base64')

// Firefox's profile goes under a home of its own and its content runs
// unsandboxed, as the e2e scenarios launch it on the box.
async function firefoxLaunch() {
  const home = mkdtempSync(join(tmpdir(), 'cella-firefox-'))
  const browser = await firefox.launch({ env: { ...process.env, HOME: home, MOZ_DISABLE_CONTENT_SANDBOX: '1' } })
  browser.once('disconnected', () => rmSync(home, { recursive: true, force: true }))
  return browser
}
const engines = { chromium: () => chromium.launch(), firefox: firefoxLaunch, webkit: () => webkit.launch() }
const wanted = (process.env.BROWSERS ?? 'chromium,firefox,webkit').split(',')

const png = await sharp(Buffer.from(printed.input, 'base64'), { raw: { width, height, channels: 4 } }).png().toBuffer()
const built = async (style) => {
  const file = await printFile(png, { width, style: PRINT_STYLES[style] })
  return `<span class="cella-print" id="${style}" data-over="${file.over}" style="width: ${width}px; aspect-ratio: ${width} / ${height}">${printMarkup(file, file.masks.map((m) => dataUrl(m.png)))}</span>`
}
const page = `<!doctype html><link rel="stylesheet" href="/print.css"><style>body { margin: 0 } body > * { margin: 0 0 8px }</style>
<cella-print id="element" src="${dataUrl(png)}" ink="error" style="width: ${width}px"></cella-print>
${await built('poster')}
${await built('screen')}
<script type="module" src="/src/print-element.ts"></script>`
const resizing = `<!doctype html><link rel="stylesheet" href="/print.css"><style>body { margin: 0 } body > * { margin: 0 0 8px }</style>
<cella-print id="resized" src="${dataUrl(png)}" ink="error" style="width: ${width / 2}px"></cella-print>
<div id="box" style="width: 0"><cella-print id="late" src="${dataUrl(png)}" ink="error"></cella-print></div>
<cella-print id="swapped" src="${dataUrl(png)}" ink="error" style="width: ${width}px"></cella-print>
<script type="module" src="/src/print-element.ts"></script>`

async function serve(route) {
  const path = new URL(route.request().url()).pathname
  if (path === '/' || path === '/resizing') {
    return route.fulfill({ contentType: 'text/html', body: path === '/' ? page : resizing })
  }
  if (path === '/print.css') {
    return route.fulfill({ contentType: 'text/css', body: css })
  }
  if (!existsSync(join(brand, path))) {
    return route.fulfill({ status: 404 })
  }
  const source = readFileSync(join(brand, path), 'utf8')
  if (path.endsWith('.ts')) {
    const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, verbatimModuleSyntax: true } }).outputText
    return route.fulfill({ contentType: 'text/javascript', body: js })
  }
  return route.fulfill({ contentType: 'text/css', body: source })
}

// The size of each mask a <cella-print> lays, and the url of its first.
const masks = (tab, id) =>
  tab.locator(`#${id}`).evaluate(async (el) => {
    const urls = [...el.children].map((s) => s.style.getPropertyValue('--mask').trim().match(/^url\("(.*)"\)$/)[1])
    const sizes = await Promise.all(
      urls.map(async (url) => {
        const img = new Image()
        img.src = url
        await img.decode()
        return [img.naturalWidth, img.naturalHeight]
      }),
    )
    return { first: urls[0], sizes }
  })

// How far a print the browser painted is from the explorer's, in levels
// of 255: the worst channel and the mean.
async function distance(shot, rgb) {
  const { data, info } = await sharp(shot).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  assert.deepEqual([info.width, info.height], [width, height])
  let worst = 0
  let sum = 0
  for (let i = 0; i < rgb.length; i++) {
    const d = Math.abs(data[i] - rgb[i])
    worst = Math.max(worst, d)
    sum += d
  }
  return { worst, mean: sum / rgb.length }
}

for (const [name, launch] of Object.entries(engines).filter(([n]) => wanted.includes(n))) {
  test(`${name} lays the print the explorer paints, at run time and from build`, async () => {
    const browser = await launch()
    try {
      const tab = await browser.newPage({ viewport: { width: 200, height: 200 }, deviceScaleFactor: 1 })
      await tab.route('http://brand.test/**', serve)
      await tab.goto('http://brand.test/')
      await tab.waitForFunction(() => document.querySelector('#element')?.children.length === 1)
      for (const [id, rgb, within] of [['element', want('house', 'error'), 'the element in error'], ['poster', want('poster'), 'the poster from build'], ['screen', want('screen'), 'the opaque screen print from build']]) {
        const { worst, mean } = await distance(await tab.locator(`#${id}`).screenshot(), rgb)
        // the browser blends each layer in 8 bits, the explorer in floats;
        // a dot out of place is a hundred levels off
        assert.ok(worst <= 3 && mean < 1, `${name}, ${within}: worst ${worst}, mean ${mean.toFixed(3)} levels from the explorer`)
      }
    } finally {
      await browser.close()
    }
  })
}

for (const [name, launch] of Object.entries(engines).filter(([n]) => wanted.includes(n))) {
  test(`${name} prints a <cella-print> again at its new width, and clears one whose picture fails`, async () => {
    const browser = await launch()
    try {
      const tab = await browser.newPage({ viewport: { width: 200, height: 200 }, deviceScaleFactor: 1 })
      await tab.route('http://brand.test/**', serve)
      await tab.goto('http://brand.test/resizing')
      await tab.waitForFunction(() => ['resized', 'swapped'].every((id) => document.getElementById(id).children.length === 1))
      // laid out at zero width, it has printed nothing, not even at its
      // picture's own width
      assert.equal(await tab.locator('#late').evaluate((el) => el.children.length), 0, `${name}: a print at zero width has no layers`)

      const narrow = await masks(tab, 'resized')
      assert.deepEqual(narrow.sizes, [[width / 2, Math.round(height / 2)]], `${name}: the print's mask is at its shown width`)
      await tab.locator('#resized').evaluate((el, w) => (el.style.width = `${w}px`), width)
      await tab.locator('#box').evaluate((el, w) => (el.style.width = `${w}px`), width)
      await tab.waitForFunction((old) => {
        const mask = (id) => document.getElementById(id).firstElementChild?.style.getPropertyValue('--mask').trim()
        return mask('resized') && mask('resized') !== `url("${old}")` && mask('late')
      }, narrow.first)
      for (const id of ['resized', 'late']) {
        assert.deepEqual((await masks(tab, id)).sizes, [[width, height]], `${name}, #${id}: the masks are at the new width`)
        const { worst, mean } = await distance(await tab.locator(`#${id}`).screenshot(), want('house', 'error'))
        assert.ok(worst <= 3 && mean < 1, `${name}, #${id} widened: worst ${worst}, mean ${mean.toFixed(3)} levels from the explorer`)
      }

      await tab.locator('#swapped').evaluate((el) => el.setAttribute('src', '/missing.png'))
      await tab.waitForFunction(() => document.getElementById('swapped').children.length === 0)
      const left = await tab.locator('#swapped').evaluate((el) => [el.style.aspectRatio, el.dataset.over ?? null])
      assert.deepEqual(left, ['', null], `${name}: a print whose picture failed keeps no shape and no over`)
    } finally {
      await browser.close()
    }
  })
}
