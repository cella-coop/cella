import { error } from '@sveltejs/kit'
import { using } from '#lib/server/db.ts'
import { setting } from '#lib/server/slices.ts'
import type { PageServerLoad } from './$types'

// A settings page: what its slice reads for the signed-in person, who
// looks, and the theme they wear, read again after a save (`cella:shell`).
// Its writes are the `write` form and `send` command of
// `#lib/remote/settings.remote.ts`.
export const load: PageServerLoad = async ({ params, locals, depends }) => {
  depends('cella:shell')
  const page = setting(params.page)
  if (!page) {
    error(404, `There is no settings page ${params.page}`)
  }
  const s = locals.session
  if (!s) {
    error(401, 'Sign in first')
  }
  return using(s.actor, async (db) => {
    const found = await page.read(db, s.actor)
    if (found === null) {
      error(404, `There is no settings page ${params.page} for ${s.actor}`)
    }
    return { name: params.page, data: found, viewer: { actor: s.actor, device: s.device }, theme: locals.theme }
  })
}
