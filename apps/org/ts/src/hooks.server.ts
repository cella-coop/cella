import type { Handle } from '@sveltejs/kit/hooks'
import { reading } from '#lib/server/db.ts'
import { touch } from '#lib/server/leases.ts'
import { read } from '#lib/server/session.ts'

const themes = ['light', 'dark', 'system'] as const

// What a person reaches before signing in: the sign-in page and its
// session, an invitation's link, the theme, and the remote functions those
// pages call (`#lib/remote/session.remote.ts`): what the shell reads,
// the scope alone for them, what the sign-in page offers, whom a link
// invites, and its acceptance, which the link's holder signs.
const open = (path: string) =>
  path === '/sign-in' ||
  path === '/session' ||
  path === '/theme' ||
  path.startsWith('/join/') ||
  /^\/_app\/remote\/[0-9a-z]+\/(shell|signing|invited|accept)$/.test(path)

// Who is signed in, from the session's cookie, read on a connection kept
// for reading sessions (`reading`), and the theme, from its own; the
// theme is written into the page so it renders right before any script
// runs. Every other route needs a session: a page asked for without one
// goes to the sign-in page, and anything else is refused.
export const handle: Handle = async ({ event, resolve }) => {
  // In a demo's room, keeps this browser's member lease alive while it
  // is seen; one idle 15 minutes is forgotten and its member freed.
  touch(event.request.headers.get('x-cella-browser'))
  event.locals.session = await reading(null, (db) => read(db, event.cookies))
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
  // The co-op has no home page for now: `/` lands the member in their
  // Inbox, what waits on them, until a better first page is designed.
  if (event.url.pathname === '/') {
    return new Response(null, { status: 307, headers: { location: '/inbox' } })
  }
  const attribute = event.locals.theme === 'system' ? '' : event.locals.theme
  return resolve(event, { transformPageChunk: ({ html }) => html.replace('%cella.theme%', attribute) })
}
