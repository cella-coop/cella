import { error } from '@sveltejs/kit'
import { command, form, getRequestEvent, query } from '$app/server'
import { texts } from '@cella/org-db'
import { dev } from '#lib/server/device.ts'
import { setting } from '#lib/server/slices.ts'
import { wear } from '#lib/server/theme.ts'
import { failed, type Answer, type Fields } from '#lib/server/write.ts'
import { sent } from './sent.ts'
import { served } from './serve.ts'
import { answer, keyed, pairs, posted, written } from './write.ts'

// A settings page: what its slice reads for the signed-in person, of the
// one thing its address names where it is a page of one (`id`, empty
// where it names none), who looks, and the theme they wear, read again
// after a save that took or reached a verdict.
export const page = query(texts(['page', 'id']), async ({ page: name, id }) => {
  const found = setting(name)
  if (!found) {
    error(404, `There is no settings page ${name}`)
  }
  const { locals } = getRequestEvent()
  const s = locals.session
  if (!s) {
    error(401, 'Sign in first')
  }
  const data = await served((db) => found.read(db, s.actor, id || undefined))
  if (data === null) {
    error(404, `There is no settings page ${id ? `${name}/${id}` : name} for ${s.actor}`)
  }
  return { name, id, data, viewer: { actor: s.actor, device: s.device }, theme: locals.theme }
})

// DEV ONLY. The settings form's specimen, a page of the design system
// that the dev server alone serves, and which reads nothing.
export const specimen = query(() => {
  if (!dev) {
    error(404, 'There is no page specimens/settings')
  }
  return true
})

// A settings page's write, by the name its slice saves by, posted with the
// one thing its address names, if any, or the theme, kept in its cookie
// as the user menu's `/theme` keeps it; the theme is no write of the
// log's, so it is not signed and names no outcome.
async function saved(page: string, name: string, data: Fields, id?: string): Promise<Answer> {
  if (name === 'theme') {
    const theme = data.get('theme')?.[0]
    if (typeof theme !== 'string' || !['light', 'dark', 'system'].includes(theme)) {
      return failed(400, `${String(theme)} is no theme: light, dark or system`)
    }
    const { cookies, url } = getRequestEvent()
    wear(cookies, theme, url)
    return { status: 200 }
  }
  return written(setting(page)?.actions?.[name], name, data, id)
}

// A settings page's form, keyed by its page, the thing it is of, if any,
// and its write.
export const write = form('unchecked', async (data: Record<string, unknown>) => {
  const key = keyed(data.id, ['settings'], ['id'])
  if (typeof key === 'string') {
    return failed(400, key)
  }
  return answer(await saved(key.at.settings!, key.write, posted(data), key.at.id), [])
})

// A settings page's saves, posted one after the other by its Save.
export const send = command(sent, async ({ at, write: name, fields }) => {
  const key = keyed({ at, write: name }, ['settings'], ['id'])
  if (typeof key === 'string') {
    return failed(400, key)
  }
  return answer(await saved(key.at.settings!, name, pairs(fields), key.at.id), [])
})
