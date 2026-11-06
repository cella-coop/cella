// The landing site (index.md): static, built into dist/, deployed nowhere
// until the operator says so.
import { defineConfig } from 'astro/config'

export default defineConfig({
  output: 'static',
})
