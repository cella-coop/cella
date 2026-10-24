import type { Handle } from '@sveltejs/kit/hooks'
import { dev } from '#lib/server/device.ts'

const themes = ['light', 'dark', 'system'] as const

// Who the dev server acts as and the theme, from their cookies; the theme
// is written into the page so it renders right before any script runs.
export const handle: Handle = async ({ event, resolve }) => {
  event.locals.actor = dev ? (event.cookies.get('cella-act') ?? null) : null
  const theme = event.cookies.get('cella-theme')
  event.locals.theme = themes.find((t) => t === theme) ?? 'system'
  const attribute = event.locals.theme === 'system' ? '' : event.locals.theme
  return resolve(event, { transformPageChunk: ({ html }) => html.replace('%cella.theme%', attribute) })
}
