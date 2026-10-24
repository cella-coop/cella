import { error, redirect } from '@sveltejs/kit'
import { dev } from '#lib/server/device.ts'
import { back } from '#lib/server/back.ts'
import type { RequestHandler } from './$types'

// DEV ONLY: whom the dev server signs as, until the browser holds the
// member's own device.
export const POST: RequestHandler = async ({ request, cookies }) => {
  if (!dev) {
    error(403, 'Acting as a member is for the dev server only')
  }
  const form = await request.formData()
  cookies.set('cella-act', String(form.get('actor') ?? ''), { path: '/', httpOnly: true, sameSite: 'lax', secure: false })
  redirect(303, back(form))
}
