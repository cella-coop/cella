// What a page's head says where it is shared (index.md, the card): the
// Open Graph and Twitter tags that point at its card, a picture
// lib/card.ts renders at build.

/** A card's size, as Open Graph asks. */
export const CARD = { w: 1200, h: 630 }

/** The site's address, its cards' and pages' absolute URLs' root. */
export const ORIGIN = 'https://cella.coop'

/** A page's card: its own, by its name or its post's, or the home page's. */
export const cardOf = (page?: string, post?: string) => (post ? `/og/blog/${post}.png` : `/og/${page ?? 'home'}.png`)

/** A page's head's Open Graph and Twitter tags. */
export const cardMeta = ({ title, description, card, path, name }: { title: string; description: string; card: string; path: string; name: string }) => [
  { property: 'og:type', content: 'website' },
  { property: 'og:site_name', content: name },
  { property: 'og:title', content: title },
  { property: 'og:description', content: description },
  { property: 'og:url', content: new URL(path, ORIGIN).href },
  { property: 'og:image', content: new URL(card, ORIGIN).href },
  { property: 'og:image:width', content: String(CARD.w) },
  { property: 'og:image:height', content: String(CARD.h) },
  { name: 'twitter:card', content: 'summary_large_image' },
]
