import { redirect } from '@sveltejs/kit'
import { back } from '#lib/server/back.ts'
import type { RequestHandler } from './$types'

export const POST: RequestHandler = async ({ request, cookies, url }) => {
  const form = await request.formData()
  const theme = String(form.get('theme'))
  const secure = url.protocol === 'https:'
  if (theme === 'light' || theme === 'dark') {
    cookies.set('cella-theme', theme, { path: '/', httpOnly: true, sameSite: 'lax', secure, maxAge: 60 * 60 * 24 * 365 })
  } else {
    cookies.delete('cella-theme', { path: '/', secure })
  }
  redirect(303, back(form))
}
