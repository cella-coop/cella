// Reading the collections the way every page does (index.md, the text).
import { getCollection, getEntry, render } from 'astro:content'
import { STATUSES } from './photo'

export const siteData = async () => (await getEntry('site', 'site'))!.data

export async function pageData(name: string) {
  const page = await getEntry('pages', name)
  if (!page) throw new Error(`no page ${name} in the pages collection`)
  return page.data
}

/** A page's sections in their order, each its anchor, data and body. */
export async function sectionsOf(page: string) {
  const prefix = `${page}/`
  const own = (await getCollection('sections')).filter((s) => s.id.startsWith(prefix))
  return Promise.all(
    own
      .sort((a, b) => a.data.order - b.data.order)
      .map(async (s) => ({ id: s.id.slice(prefix.length), data: s.data, ...(await render(s)) })),
  )
}

/** The blog's posts, newest first; drafts only in the dev server. */
export async function posts() {
  return (await getCollection('blog', (p) => import.meta.env.DEV || !p.data.draft)).sort(
    (a, b) => b.data.date.valueOf() - a.data.date.valueOf(),
  )
}

/** A page's bands take the five tones in turn: the hero the first, its
 * sections the rest, so no two bands in a row share one. */
export const toneOf = (band: number) => STATUSES[band % STATUSES.length]

export const dated =(d: Date) => d.toLocaleDateString('en', { day: 'numeric', month: 'long', year: 'numeric' })
