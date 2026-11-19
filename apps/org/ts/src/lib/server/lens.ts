import { today, type Db } from '@cella/org-db'
import { lenses } from '@cella/org-circle/api'
import type { Lens } from '@cella/org-circle/models'

// What is read of the request's cookies.
type Jar = { get(name: string): string | undefined }

// The circles the coop selector offers the member, the assembly first,
// then those they sit in, and their lens: the circle their cookie names
// where they read it, else none, as a circle they no longer read, the
// assembly, where the coop reads whole, or another scope's is.
export async function lensing(db: Db, cookies: Jar, actor: string): Promise<{ circles: Lens[]; lens: Lens | null }> {
  const circles = await lenses(db, actor, await today(db))
  const named = cookies.get('cella-lens')
  return { circles, lens: circles.find((c) => c.id === named && !c.assembly) ?? null }
}

// The circle a collection is read through, the member's lens, or none.
export async function lensed(db: Db, cookies: Jar, actor: string | null): Promise<string | null> {
  return actor && cookies.get('cella-lens') ? ((await lensing(db, cookies, actor)).lens?.id ?? null) : null
}
