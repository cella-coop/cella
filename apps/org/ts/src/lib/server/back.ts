// Where a menu's form returns to: a path on this server, never elsewhere.
// Browsers read a backslash as a slash, so `/\host` is `//host`, another
// origin; a path with one goes home instead.
export function back(form: FormData): string {
  const path = String(form.get('back') ?? '/')
  return path.startsWith('/') && !path.startsWith('//') && !path.includes('\\') ? path : '/'
}
