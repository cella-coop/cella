// Where a menu's form returns to: a path on this server, never elsewhere.
export function back(form: FormData): string {
  const path = String(form.get('back') ?? '/')
  return path.startsWith('/') && !path.startsWith('//') ? path : '/'
}
