import { redirect } from '@sveltejs/kit'
import { release } from '#lib/server/leases.ts'
import { end } from '#lib/server/session.ts'
import type { RequestHandler } from './$types'

// Ends the session; the device stays in the browser, to sign in again.
// In a demo's room, frees the member this browser leased, for another
// to pick.
export const POST: RequestHandler = async ({ cookies, request, url }) => {
  release(request.headers.get('x-cella-browser'))
  end(cookies, url.protocol === 'https:')
  redirect(303, '/sign-in')
}
