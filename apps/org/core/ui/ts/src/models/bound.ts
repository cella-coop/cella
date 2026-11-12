// A write's field as its `write` form posts it: SvelteKit binds each
// field of a remote form to it by name, `<path>/<form>`, a path of
// letters, digits and `_` alone, so a field's own name, which may hold
// any character, is spelled in them, each `_` doubled and any other
// character but a letter or a digit, or a digit first, as `_` and its
// UTF-16 code in four hex digits, under `f`, each a list (`[]`), so a
// name a form repeats, as a grid's rows, posts each value. `unbound`
// reads the name back.
export function bound(name: string, form: string): string {
  return `f.${spelled(name)}[]/${form}`
}

export function spelled(name: string): string {
  let out = ''
  for (let i = 0; i < name.length; i++) {
    const c = name[i]!
    out += c === '_' ? '__' : /[A-Za-z]/.test(c) || (i > 0 && /[0-9]/.test(c)) ? c : `_${name.charCodeAt(i).toString(16).padStart(4, '0')}`
  }
  return out
}

export function unbound(spelt: string): string {
  return spelt.replace(/__|_([0-9a-f]{4})/g, (_, hex: string | undefined) => (hex ? String.fromCharCode(parseInt(hex, 16)) : '_'))
}

// The form a remote form's action posts to, `<hash>/<name>`, which every
// field it binds ends in.
export function formOf(action: string): string {
  const id = decodeURIComponent(action.split('/remote=')[1]?.split('&')[0] ?? '')
  return id.split('/').slice(0, 2).join('/')
}
