import type { Handle } from '@sveltejs/kit/hooks'
import { using } from '#lib/server/db.ts'
import { read } from '#lib/server/session.ts'

const themes = ['light', 'dark', 'system'] as const

// What a person reaches before signing in: the sign-in page and its
// session, an invitation's link, and the theme.
const open = (path: string) => path === '/sign-in' || path === '/session' || path === '/theme' || path.startsWith('/join/')

// Who is signed in, from the session's cookie, and the theme, from its
// own; the theme is written into the page so it renders right before any
// script runs. Every other route needs a session: a page asked for
// without one goes to the sign-in page, and anything else is refused.
export const handle: Handle = async ({ event, resolve }) => {
  event.locals.session = await using((db) => read(db, event.cookies))
  event.locals.actor = event.locals.session?.actor ?? null
  const theme = event.cookies.get('cella-theme')
  event.locals.theme = themes.find((t) => t === theme) ?? 'system'
  if (!event.locals.session && !open(event.url.pathname)) {
    const page = event.request.method === 'GET' && (event.request.headers.get('accept') ?? '').includes('text/html')
    if (page) {
      const back = event.url.pathname + event.url.search
      return new Response(null, { status: 303, headers: { location: `/sign-in?back=${encodeURIComponent(back)}` } })
    }
    return new Response('Sign in first', { status: 401 })
  }
  const attribute = event.locals.theme === 'system' ? '' : event.locals.theme
  return resolve(event, { transformPageChunk: ({ html }) => html.replace('%cella.theme%', attribute) })
}
