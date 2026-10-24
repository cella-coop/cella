import { chromium } from 'playwright-core'
import { createServer } from 'vite'

const server = await createServer({ configFile: new URL('../vite.config.ts', import.meta.url).pathname, server: { port: 5181 } })
await server.listen()
const browser = await chromium.launch()
try {
  const page = await browser.newPage()
  page.on('console', (m) => console.log('console:', m.type(), m.text()))
  page.on('pageerror', (e) => console.log('pageerror:', e.message))
  await page.goto('http://localhost:5181/')
  await page.waitForSelector('[data-row]', { timeout: 20000 })
  console.log('rows', await page.locator('[data-side=Ada] [data-row]').count())
  console.log(await page.locator('[data-testid=converged]').textContent())
  await page.screenshot({ path: '/tmp/smoke.png', fullPage: true })
} finally {
  await browser.close()
  await server.close()
}
