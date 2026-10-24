import { defineConfig } from '@playwright/test'

// Browsers come from nixpkgs' playwright-driver.browsers (version-matched
// to @playwright/test): PLAYWRIGHT_BROWSERS_PATH points at them.
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  workers: 1,
  use: { baseURL: 'http://localhost:5192', browserName: 'chromium', viewport: { width: 1400, height: 1000 } },
  // Its own port, so the run never meets a `pnpm dev` on 5182.
  webServer: { command: 'pnpm exec vite dev --port 5192 --strictPort', port: 5192, reuseExistingServer: false, timeout: 60_000 },
})
