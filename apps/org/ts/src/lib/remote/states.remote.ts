import { error } from '@sveltejs/kit'
import { query } from '$app/server'
import { dev } from '#lib/server/device.ts'

// DEV ONLY. The states specimen, a page of the design system proposing
// the one look a state draws, a pill with a dot, and Panel's header
// shared by Section and the drawer's Card, which the dev server alone
// serves and which reads nothing.
export const states = query(() => {
  if (!dev) {
    error(404, 'There is no page specimens/states')
  }
  return true
})
