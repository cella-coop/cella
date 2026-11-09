import { error } from '@sveltejs/kit'
import { dev } from '#lib/server/device.ts'
import type { PageServerLoad } from './$types'

// DEV ONLY. The settings form's specimen: a page of the design system,
// not of any slice, served by the dev server alone, so a browser test
// can see a form that mixes a setting its reader saves with one only a
// motion changes. It reads nothing and has no actions: whatever it posts
// goes nowhere, and a test answers it.
export const load: PageServerLoad = async () => {
  if (!dev) {
    error(404, 'There is no page specimens/settings')
  }
  return {}
}
