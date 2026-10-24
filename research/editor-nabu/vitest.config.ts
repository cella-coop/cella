import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vitest/config'

// Unit tests drive nabu's engine directly; happy-dom stands in for the
// document its selection classes subscribe to.
export default defineConfig({
  plugins: [svelte()],
  resolve: { conditions: ['browser', 'svelte'] },
  test: {
    environment: 'happy-dom',
    include: ['tests/unit/**/*.test.ts'],
    server: { deps: { inline: ['@aionbuilders/nabu'] } },
  },
})
