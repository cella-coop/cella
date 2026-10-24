// Whether a key press belongs to a field being typed in, which single-key
// shortcuts leave alone.
export function typing(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null
  if (!t) {
    return false
  }
  return t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)
}
