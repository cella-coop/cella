import { sveltekit } from '@sveltejs/kit/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [sveltekit({})],
  server: { port: 5182, strictPort: true },
  // nabu ships its Svelte sources, so it is compiled with the app.
  ssr: { noExternal: ['@aionbuilders/nabu'] },
  optimizeDeps: { exclude: ['@aionbuilders/nabu', 'loro-crdt'] },
})
