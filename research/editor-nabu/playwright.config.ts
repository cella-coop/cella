import { defineConfig } from '@playwright/test'

// Browsers come from nixpkgs' playwright-driver.browsers (version-matched
// to @playwright/test): PLAYWRIGHT_BROWSERS_PATH points at them.
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  workers: 1,
  use: { baseURL: 'http://localhost:5182', browserName: 'chromium', viewport: { width: 1400, height: 1000 } },
  webServer: { command: 'pnpm dev', port: 5182, reuseExistingServer: false, timeout: 60_000 },
})
