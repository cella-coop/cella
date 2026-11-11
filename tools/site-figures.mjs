// `cella check site`: build the figure fixture under apps/site/test twice,
// once as it is and once with an icon name Phosphor lacks; the first must
// build, its HTML inlining no photo, and the second must fail naming that
// icon.
// `cella site screenshots`: build it once and take its four screenshots.
// The fixture photo is made from the brand's print fixture for the build
// alone, so no invented credit is ever committed as a vendored photo.
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { createServer } from 'node:http'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { chromium } from 'playwright-core'
const sharp = createRequire(new URL('../packages/brand/package.json', import.meta.url))('sharp')

export const badIcon = 'not-a-phosphor-icon'

// What a build of the fixture says, or null where it did what it must.
export function judge(bad, { status, stdout, stderr }) {
  if (bad && status === 0) return `the fixture built with the icon ${badIcon}, which Phosphor lacks`
  if (bad && !stderr.includes(badIcon)) return `the fixture failed without naming the icon ${badIcon}:\n${stdout}\n${stderr}`
  if (!bad && status !== 0) return `the fixture does not build:\n${stdout}\n${stderr}`
  return null
}

// What the fixture's HTML says, or null where it inlines no photo.
export function inlined(html) {
  return html.includes('data:image/jpeg') ? 'the fixture inlines an unprinted photo as a data URL' : null
}

function build(site, out, bad) {
  return spawnSync('pnpm', ['exec', 'astro', 'build', '--config', 'test/astro.config.mjs', '--outDir', out], {
    cwd: site, encoding: 'utf8', env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1', FIGURE_TEST_BAD_ICON: bad ? '1' : '' },
  })
}

// Runs `body` with the fixture photo in the site's photos, removed after.
async function withPhoto(site, body) {
  const photos = join(site, 'src/photos')
  mkdirSync(photos, { recursive: true })
  const fixture = JSON.parse(readFileSync(new URL('_tests/brand/explorer-print.json', import.meta.url), 'utf8'))
  const jpg = join(photos, 'fixture.jpg')
  const json = join(photos, 'fixture.json')
  try {
    await sharp(Buffer.from(fixture.input, 'base64'), { raw: { width: fixture.width, height: fixture.height, channels: 4 } }).jpeg().toFile(jpg)
    writeFileSync(json, JSON.stringify({ photographer: 'Fixture', photographerUrl: 'https://unsplash.com/@fixture', photoUrl: 'https://unsplash.com/photos/fixture', id: 'fixture', licence: 'Unsplash License', licenceUrl: 'https://unsplash.com/license' }))
    return await body()
  } finally {
    rmSync(jpg, { force: true })
    rmSync(json, { force: true })
  }
}

export async function check(site, out) {
  await withPhoto(site, async () => {
    for (const bad of [true, false]) {
      const fault = judge(bad, build(site, out, bad))
      if (fault) throw new Error(fault)
    }
    const fault = inlined(readFileSync(join(out, 'test/figures/index.html'), 'utf8'))
    if (fault) throw new Error(fault)
  })
  console.log('the figure fixture builds, inlines no photo, and refuses an unknown icon')
}

export async function screenshots(site, out) {
  await withPhoto(site, async () => {
    const fault = judge(false, build(site, out, false))
    if (fault) throw new Error(fault)
  })
  const server = createServer((req, res) => {
    const path = req.url.endsWith('/') ? `${req.url.slice(1)}index.html` : req.url.slice(1)
    if (!/^[a-zA-Z0-9_./-]+$/.test(path) || path.includes('..')) { res.writeHead(400).end(); return }
    try {
      res.setHeader('Content-Type', path.endsWith('.css') ? 'text/css' : path.endsWith('.html') ? 'text/html' : 'application/octet-stream')
      res.end(readFileSync(join(out, path)))
    } catch { res.writeHead(404).end() }
  })
  await new Promise(done => server.listen(0, '127.0.0.1', done))
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
  try {
    const page = await browser.newPage({ viewport: { width: 800, height: 1100 }, deviceScaleFactor: 1 })
    await page.goto(`http://127.0.0.1:${server.address().port}/test/figures/`)
    for (const theme of ['light', 'dark']) {
      for (const layout of ['over', 'beside']) {
        const file = join(site, 'test', `${theme}-${layout}.png`)
        await page.locator(`main[data-theme="${theme}"] figure[data-layout="${layout}"]`).screenshot({ path: file })
        console.log(file)
      }
    }
  } finally {
    await browser.close()
    server.close()
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2)
  const shoot = args[0] === '--screenshots'
  const [site, out] = (shoot ? args.slice(1) : args).map(p => resolve(p))
  try {
    await (shoot ? screenshots : check)(site, out)
  } catch (e) {
    console.error(e.message)
    process.exit(1)
  }
}
