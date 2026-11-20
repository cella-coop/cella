import type { Handle } from '@sveltejs/kit/hooks'
import { reading } from '#lib/server/db.ts'
import { copy } from '#lib/server/device.ts'
import { ends, renew, touch } from '#lib/server/leases.ts'
import { safe } from '#lib/server/back.ts'
import { end, ended, read } from '#lib/server/session.ts'

const themes = ['light', 'dark', 'system'] as const

// What a person reaches before signing in: the sign-in page, the way to
// it once a session ended under a page (`/sign-in/ended/now`) and its
// session, an invitation's link, the theme, and the remote functions those
// pages call (`#lib/remote/session.remote.ts`): what the shell reads,
// the scope alone for them, what the sign-in page offers, whom a link
// invites, and its acceptance, which the link's holder signs.
const open = (path: string) =>
  path === '/sign-in' ||
  path === '/sign-in/ended/now' ||
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
  // member's lease: signed out elsewhere, or the lease moved on (another
  // browser's sign-in, or this one's own switch to another room). One
  // that lapsed by idleness alone, its member taken by no one since, is
  // renewed, so a visitor back from a pause carries on where they were
  // (`renew`). Refused the same as signing out, on every request, not
  // only at sign-in, so a session cookie alone is never enough; where
  // another browser took the member, the sign-in says so, by the room's
  // own record of it (`lost`), never the link's.
  const secure = event.url.protocol === 'https:'
  let ending: string[] = []
  if (event.locals.session && !renew(event.locals.session.actor, browser)) {
    end(event.cookies, secure)
    ending = ended(event.cookies, secure)
    event.locals.session = null
  }
  event.locals.actor = event.locals.session?.actor ?? null
  const theme = event.cookies.get('cella-theme')
  event.locals.theme = themes.find((t) => t === theme) ?? 'system'
  if (!event.locals.session && !open(event.url.pathname)) {
    const headers = new Headers()
    for (const cookie of ending) {
      headers.append('set-cookie', cookie)
    }
    const get = event.request.method === 'GET'
    const page = get && (event.request.headers.get('accept') ?? '').includes('text/html')
    if (page) {
      headers.set('location', `/sign-in?back=${encodeURIComponent(event.url.pathname + event.url.search)}`)
      return new Response(null, { status: 303, headers })
    }
    // In a demo's room, a query a page's script asks, as its next click
    // does once the session ended under it: answered with the redirect
    // SvelteKit's client follows from a query, `{ redirect }` in
    // devalue's form, to a page it loads in full (`/sign-in/ended/now`),
    // never a bare 401 its page would draw as broken. A command cannot
    // redirect, so one is refused as before, and so is every query
    // outside a room, a real scope's 401 unchanged.
    if (copy && get && event.url.pathname.startsWith('/_app/remote/')) {
      headers.set('cache-control', 'private, no-store')
      return Response.json({ type: 'result', data: JSON.stringify([{ redirect: 1 }, '/sign-in/ended/now']) }, { headers })
    }
    return new Response('Sign in first', { status: 401, headers })
  }
  // Signed in, the sign-in page is passed by: a tab left on it once a
  // session ended, reloaded after the member signed in again, goes where
  // it was going, its `back` if that is a page of this origin, else home,
  // never the sign-in drawn inside the shell (the operator, 20 Nov).
  if (event.url.pathname === '/sign-in' && event.locals.session && event.request.method === 'GET') {
    const back = event.url.searchParams.get('back') ?? ''
    const path = safe(back)
    const location = path !== '/' && !path.startsWith('/sign-in') ? path : '/inbox'
    return new Response(null, { status: 303, headers: { location } })
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
