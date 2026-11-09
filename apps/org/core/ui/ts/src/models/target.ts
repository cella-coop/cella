// A page action's address: the action keeps the page's address, as its
// open tab, so the page the write returns to is the one it was made from.
export function target(action: string, params: Iterable<[string, string]>): string {
  const kept = [...params].filter(([k]) => !k.startsWith('/'))
  return `?/${action}${kept.length ? `&${new URLSearchParams(kept)}` : ''}`
}
