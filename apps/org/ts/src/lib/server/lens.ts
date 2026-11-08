import type { Cookies } from '@sveltejs/kit'
import { today, type Db } from '@cella/org-db'
import { lenses } from '@cella/org-circle/api'
import type { Lens } from '@cella/org-circle/models'

// The circles the co-op selector offers the member, those they sit in
// first, and their lens: the circle their cookie names where they read
// it, else none, as a circle they no longer read or another scope's is.
export async function lensing(db: Db, cookies: Cookies, actor: string): Promise<{ circles: Lens[]; lens: Lens | null }> {
  const circles = await lenses(db, actor, await today(db))
  const named = cookies.get('cella-lens')
  return { circles, lens: circles.find((c) => c.id === named) ?? null }
}

// The circle a collection is read through, the member's lens, or none.
export async function lensed(db: Db, cookies: Cookies, actor: string | null): Promise<string | null> {
  return actor && cookies.get('cella-lens') ? ((await lensing(db, cookies, actor)).lens?.id ?? null) : null
}
