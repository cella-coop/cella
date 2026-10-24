import { fileURLToPath } from 'node:url'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vitest/config'

// Unit tests drive nabu's engine directly; happy-dom stands in for the
// document its selection classes subscribe to. Svelte resolves to its
// browser build, so runes run as in the page; Loro to its Node build,
// whose WebAssembly Node loads itself.
export default defineConfig({
  plugins: [svelte()],
  resolve: {
    conditions: ['browser', 'svelte'],
    alias: [{ find: /^loro-crdt$/, replacement: fileURLToPath(new URL('node_modules/loro-crdt/nodejs/index.js', import.meta.url)) }],
  },
  test: {
    environment: 'happy-dom',
    include: ['tests/unit/**/*.test.ts'],
    server: { deps: { inline: ['@aionbuilders/nabu'] } },
  },
})
