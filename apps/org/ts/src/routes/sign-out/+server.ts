import { redirect } from '@sveltejs/kit'
import { end } from '#lib/server/session.ts'
import type { RequestHandler } from './$types'

// Ends the session; the device stays in the browser, to sign in again.
export const POST: RequestHandler = async ({ cookies, url }) => {
  end(cookies, url.protocol === 'https:')
  redirect(303, '/sign-in')
}
