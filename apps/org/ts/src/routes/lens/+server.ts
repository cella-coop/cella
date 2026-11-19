import { redirect } from '@sveltejs/kit'
import { back } from '#lib/server/back.ts'
import type { RequestHandler } from './$types'

// The member's lens, a circle the coop selector chose, kept in a cookie
// as the theme is and never in the log; none clears it. The root layout
// reads it, and a lens naming a circle the member does not read is none.
export const POST: RequestHandler = async ({ request, cookies, url }) => {
  const form = await request.formData()
  const lens = String(form.get('lens') ?? '')
  const secure = url.protocol === 'https:'
  if (lens) {
    cookies.set('cella-lens', lens, { path: '/', httpOnly: true, sameSite: 'lax', secure, maxAge: 60 * 60 * 24 * 365 })
  } else {
    cookies.delete('cella-lens', { path: '/', secure })
  }
  redirect(303, back(form))
}
