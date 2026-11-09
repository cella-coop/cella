import { redirect } from '@sveltejs/kit'
import { back } from '#lib/server/back.ts'
import { wear } from '#lib/server/theme.ts'
import type { RequestHandler } from './$types'

export const POST: RequestHandler = async ({ request, cookies, url }) => {
  const form = await request.formData()
  wear(cookies, String(form.get('theme')), url)
  redirect(303, back(form))
}
