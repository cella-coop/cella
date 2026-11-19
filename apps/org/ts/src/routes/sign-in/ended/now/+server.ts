import { redirect } from '@sveltejs/kit'
import type { RequestHandler } from './$types'

// Where the server hook sends a page's script whose session ended under
// it in a demo's room (`hooks.server.ts`), by the redirect a query
// answers: a path no page of the client's router matches, so SvelteKit's
// client loads it in full rather than navigating in place, which, begun
// from inside a page still being loaded, never settles, and would keep
// the ended session's shell around the sign-in. It lands on the sign-in,
// which says, by the room's own record, whom another browser took from
// this one (`lost`, `#lib/server/leases.ts`).
export const GET: RequestHandler = () => {
  redirect(303, '/sign-in')
}
