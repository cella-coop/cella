import { chromium } from 'playwright-core'
import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const dist = resolve('apps/site/dist')
const server = createServer((req, res) => {
  const path = req.url === '/test/figures/' ? 'test/figures/index.html' : req.url.slice(1)
  if (!/^[a-zA-Z0-9_./-]+$/.test(path) || path.includes('..')) { res.writeHead(400).end(); return }
  try {
    res.setHeader('Content-Type', path.endsWith('.css') ? 'text/css' : path.endsWith('.html') ? 'text/html' : 'application/octet-stream')
    res.end(readFileSync(join(dist, path)))
  } catch { res.writeHead(404).end() }
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
try {
  const page = await browser.newPage({ viewport: { width: 800, height: 1100 }, deviceScaleFactor: 1 })
  await page.goto(`http://127.0.0.1:${server.address().port}/test/figures/`)
  for (const theme of ['light', 'dark']) {
    for (const layout of ['over', 'beside']) {
      const figure = page.locator(`main[data-theme="${theme}"] figure[data-layout="${layout}"]`)
      await figure.screenshot({ path: resolve(`apps/site/test/${theme}-${layout}.png`) })
    }
  }
} finally {
  await browser.close()
  server.close()
}
