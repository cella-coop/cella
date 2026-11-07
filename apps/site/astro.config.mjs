// The landing site (index.md): static, built into dist/, deployed nowhere
// until the operator says so. Its sections are MDX, so their text places
// the site's figures where it reads.
import { defineConfig } from 'astro/config'
import mdx from '@astrojs/mdx'
import svelte from '@astrojs/svelte'

export default defineConfig({
  output: 'static',
  integrations: [mdx(), svelte()],
  devToolbar: { enabled: false },
})
