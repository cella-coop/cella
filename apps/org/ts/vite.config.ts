import { fileURLToPath } from 'node:url'
import adapter from '@sveltejs/adapter-node'
import { sveltekit } from '@sveltejs/kit/vite'
import { defineConfig } from 'vite'

// The repository root: the feats' packages are linked from it, outside
// this package, and Vite serves their sources.
const repo = fileURLToPath(new URL('../../..', import.meta.url))

export default defineConfig({
  plugins: [
    // Remote functions and async Svelte, both experimental: svelte and the
    // kit are pinned to exact versions in package.json.
    sveltekit({
      adapter: adapter(),
      compilerOptions: { experimental: { async: true } },
      experimental: { remoteFunctions: true },
    }),
  ],
  server: {
    fs: { allow: [repo] },
  },
  // Phosphor ships Svelte sources only, so SSR bundles it rather than
  // importing it from node_modules. Loro loads its WebAssembly beside its
  // own files, and pg is plain Node, so the server imports both at run time
  // instead; the feats' packages, linked in, are bundled as source.
  ssr: {
    noExternal: ['phosphor-svelte'],
    external: ['loro-crdt', 'pg'],
  },
  // In the browser, Loro's bundler build imports its WebAssembly as an ES
  // module, which Vite serves as is; pre-bundling it would split the glue
  // from the module.
  optimizeDeps: { exclude: ['loro-crdt'] },
})
