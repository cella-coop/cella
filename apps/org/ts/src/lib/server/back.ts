// Where a menu's form returns to: a path on this server, never elsewhere.
// Browsers read a backslash as a slash, so `/\host` is `//host`, another
// origin; a path with one goes home instead.
export function safe(path: string): string {
  return path.startsWith('/') && !path.startsWith('//') && !path.includes('\\') ? path : '/'
}

export function back(form: FormData): string {
  return safe(String(form.get('back') ?? '/'))
}
