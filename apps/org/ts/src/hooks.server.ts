import type { Handle } from '@sveltejs/kit/hooks'
import { reading } from '#lib/server/db.ts'
import { ends, holds, touch } from '#lib/server/leases.ts'
import { end, read } from '#lib/server/session.ts'

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
  const browser = event.request.headers.get('x-cella-browser')
  touch(browser)
  event.locals.session = await reading(null, (db) => read(db, event.cookies))
  // A session authorizes nothing once its browser no longer holds its
  // member's lease: idle-ejected, signed out elsewhere, or the lease
  // moved on (another browser's sign-in, or this one's own switch to
  // another room). Refused the same as signing out, on every request,
  // not only at sign-in, so a session cookie alone is never enough.
  if (event.locals.session && !holds(event.locals.session.actor, browser)) {
    end(event.cookies, event.url.protocol === 'https:')
    event.locals.session = null
  }
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
  // The coop has no home page for now: `/` lands the member in their
  // Inbox, what waits on them, until a better first page is designed.
  if (event.url.pathname === '/') {
    return new Response(null, { status: 307, headers: { location: '/inbox' } })
  }
  const attribute = event.locals.theme === 'system' ? '' : event.locals.theme
  const response = await resolve(event, { transformPageChunk: ({ html }) => html.replace('%cella.theme%', attribute) })
  // Once this room's lifetime is counting (`leases.ts`'s first grant),
  // every response says so, so the room's own front (`tools/demo-serve.mjs`,
  // never this process) learns of it and times the room's end from it,
  // rather than guessing at `/_demo/start`. Never sent to the browser, a
  // page's own data carries it instead (`#lib/remote/session.remote.ts`).
  const until = ends()
  if (until) {
    response.headers.set('x-cella-demo-ends', String(until))
  }
  return response
}
