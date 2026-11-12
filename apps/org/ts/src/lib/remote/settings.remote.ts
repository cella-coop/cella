import { command, form, getRequestEvent } from '$app/server'
import { setting } from '#lib/server/slices.ts'
import { wear } from '#lib/server/theme.ts'
import { failed, type Answer, type Fields } from '#lib/server/write.ts'
import { sent } from './sent.ts'
import { answer, keyed, pairs, posted, written } from './write.ts'

// A settings page's write, by the name its slice saves by, or the theme,
// kept in its cookie as the user menu's `/theme` keeps it; the theme is no
// write of the log's, so it is not signed and names no outcome.
async function saved(page: string, name: string, data: Fields): Promise<Answer> {
  if (name === 'theme') {
    const theme = data.get('theme')?.[0]
    if (typeof theme !== 'string' || !['light', 'dark', 'system'].includes(theme)) {
      return failed(400, `${String(theme)} is no theme: light, dark or system`)
    }
    const { cookies, url } = getRequestEvent()
    wear(cookies, theme, url)
    return { status: 200 }
  }
  return written(setting(page)?.actions?.[name], name, data)
}

// A settings page's form, keyed by its page and its write.
export const write = form('unchecked', async (data: Record<string, unknown>) => {
  const key = keyed(data.id, ['settings'])
  if (typeof key === 'string') {
    return failed(400, key)
  }
  return answer(await saved(key.at.settings!, key.write, posted(data)), [])
})

// A settings page's saves, posted one after the other by its Save.
export const send = command(sent, async ({ at, write: name, fields }) => {
  const key = keyed({ at, write: name }, ['settings'])
  if (typeof key === 'string') {
    return failed(400, key)
  }
  return answer(await saved(key.at.settings!, name, pairs(fields)), [])
})
