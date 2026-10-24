import { expect, test } from '@playwright/test'

test('renders', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  await page.goto('/')
  await page.waitForTimeout(3000)
  console.log('ERRORS', errors.join('\n'))
  await expect(page.getByTestId('converged')).toHaveText('Converged')
  await page.screenshot({ path: '/home/ixxie/.claude/jobs/83da3889/tmp/editor-nabu-shots/smoke.png', fullPage: true })
  console.log(errors.join('\n'))
})
