import { error, fail, type Actions } from '@sveltejs/kit'
import { using } from '#lib/server/db.ts'
import { saves, setting } from '#lib/server/slices.ts'
import { wear } from '#lib/server/theme.ts'
import { perform } from '#lib/server/write.ts'
import type { PageServerLoad } from './$types'

// A settings page: what its slice reads for the signed-in person, who
// looks, and the theme they wear, which the page's `theme` saves.
export const load: PageServerLoad = async ({ params, locals }) => {
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

// The page's own writes, run as any page's are, and the theme, kept in
// its cookie as the user menu's `/theme` keeps it; the theme is no
// write of the log's, so it is not signed.
export const actions = {
  ...Object.fromEntries(
    saves.map((w) => [w, (event: Parameters<Actions[string]>[0]) => perform(event, `settings/${event.params.page}`, w, undefined, setting(event.params.page ?? '')?.actions?.[w])]),
  ),
  theme: async ({ request, cookies, url }) => {
    const theme = String((await request.formData()).get('theme'))
    if (!['light', 'dark', 'system'].includes(theme)) {
      return fail(400, { done: { op: 'none:none:none', state: 'failed', reason: `${theme} is no theme: light, dark or system`, then: [] } })
    }
    wear(cookies, theme, url)
    return {}
  },
} satisfies Actions
