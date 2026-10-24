import { sveltekit } from '@sveltejs/kit/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [sveltekit()],
  server: { port: 5181, strictPort: true },
  // Loro's bundler build imports its WebAssembly as an ES module, which
  // Vite serves as is; pre-bundling it would split the glue from the module.
  optimizeDeps: { exclude: ['loro-crdt'] },
})
