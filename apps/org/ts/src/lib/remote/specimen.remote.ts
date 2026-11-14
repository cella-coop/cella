import { error } from '@sveltejs/kit'
import { query } from '$app/server'
import { dev } from '#lib/server/device.ts'

// DEV ONLY. The ink specimen, a page of the design system proposing where
// the brand's inks go, which the dev server alone serves and which reads
// nothing.
export const ink = query(() => {
  if (!dev) {
    error(404, 'There is no page specimens/ink')
  }
  return true
})
