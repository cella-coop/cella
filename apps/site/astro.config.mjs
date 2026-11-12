// The landing site (index.md): static, built into dist/, released to
// cella.coop by `cella site release` from what main holds. Its pages and
// posts are MDX, each a file placing the site's components where it
// reads, its sections numbered at build so they lay themselves out by
// their order (src/lib/sections.ts).
import { defineConfig } from 'astro/config'
import mdx from '@astrojs/mdx'
import svelte from '@astrojs/svelte'
import { sections } from './src/lib/sections.ts'

export default defineConfig({
  output: 'static',
  integrations: [mdx(), svelte()],
  vite: { plugins: [sections()] },
  devToolbar: { enabled: false },
})
