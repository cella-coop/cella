// Where a section stands on its page (index.md, the layout): the ink it
// takes in the page's turn, the seed its cells are cut by, and the anchor
// its heading gives it. `sections.ts` numbers a page's sections at build;
// these read those numbers.
import { STATUSES, type Status } from '../schemas'
import { siteData } from './text'

const TURN: Status[] = ['error', 'info', 'warning', 'success', 'help']

/** The custom property of an ink, `--p0` to `--p4`. */
export const swatch = (ink: Status) => `var(--p${STATUSES.indexOf(ink)})`

/** The ink at a place in a page's turn: home starts at the coral, every
 * other page a step on for each place it holds in the header's links, so
 * no two open alike; a post starts as the blog does. */
export async function inkAt(page: string, turn: number): Promise<Status> {
  const site = await siteData()
  const start = page === 'home' ? 0 : site.nav.findIndex((l) => l.href.replace(/\/$/, '') === `/${page}`) + 1
  return TURN[(start + turn) % TURN.length]
}

/** A post's ink: its own `ink`, or its place in the order the posts were
 * published, oldest first, in the five inks' turn, so it never changes as
 * posts follow it and no two posts in a row share one. */
export async function postInk(id: string): Promise<Status> {
  const { posts } = await import('./text')
  const all = (await posts()).slice().sort((a, b) => a.data.date.valueOf() - b.data.date.valueOf() || a.id.localeCompare(b.id))
  const post = all.find((p) => p.id === id)
  if (post?.data.ink) {
    return post.data.ink
  }
  return TURN[Math.max(0, all.indexOf(post!)) % TURN.length]
}

/** A seed, the same on every build, from a section's page and place. */
export const seedOf = (key: string) => [...key].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % 997

/** An anchor from a heading: its words, lowercased, joined by dashes. */
export const anchor = (heading: string) =>
  heading
    .replace(/\*/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

/** The four inks a band hands its lists, its own left out. */
export const handed = (ink: Status) =>
  Object.fromEntries(
    STATUSES.filter((s) => s !== ink).map((s, k) => [`--b${k}`, swatch(s)]),
  )
