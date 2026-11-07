import type { Cookies } from '@sveltejs/kit'

// Keeps the theme a person chose, light or dark, in its cookie for a
// year, which the server writes into the page before any script runs;
// any other value, the system's, clears it.
export function wear(cookies: Cookies, theme: string, url: URL) {
  const secure = url.protocol === 'https:'
  if (theme === 'light' || theme === 'dark') {
    cookies.set('cella-theme', theme, { path: '/', httpOnly: true, sameSite: 'lax', secure, maxAge: 60 * 60 * 24 * 365 })
  } else {
    cookies.delete('cella-theme', { path: '/', secure })
  }
}
