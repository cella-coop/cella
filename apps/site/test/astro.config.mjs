import base from '../astro.config.mjs'
import { defineConfig } from 'astro/config'

export default defineConfig({
  ...base,
  integrations: [...base.integrations, {
    name: 'figure-fixture',
    hooks: {
      'astro:config:setup': ({ injectRoute }) => injectRoute({ pattern: '/test/figures', entrypoint: './test/figures.astro' }),
    },
  }],
})
