// The site's text as every page reads it (index.md, the text): the
// operator's entry with its draft laid under it, field by field. A field
// the operator wrote wins whole; one they left out, or an empty body, is
// the draft's, and is marked drafted, so the dev server underlines it and
// a release refuses it while any remains.
import { getCollection, render, type CollectionEntry } from 'astro:content'
import { section, site as siteSchema, type Section } from '../schemas'

type Json = Record<string, unknown>
const plain = (v: unknown): v is Json => !!v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date)
const absent = (v: unknown) => v === undefined || v === null || v === ''

/** The operator's value over the draft's, objects merged key by key, with
 * the paths the draft supplied. */
function merge(own: unknown, draft: unknown, path: string, drafted: Set<string>): unknown {
  if (absent(own)) {
    if (!absent(draft)) {
      drafted.add(path)
    }
    return draft
  }
  if (plain(own) && plain(draft)) {
    const keys = new Set([...Object.keys(own), ...Object.keys(draft)])
    return Object.fromEntries([...keys].map((k) => [k, merge(own[k], draft[k], path ? `${path}.${k}` : k, drafted)]))
  }
  return own
}

/** Whether a field, or the object holding it, is a draft's: an attribute's
 * value, `data-drafted`, or none. */
export type Marks = (path: string) => true | undefined
const marks = (drafted: Set<string>): Marks => (path) => {
  const parts = path.split('.')
  return parts.some((_, i) => drafted.has(parts.slice(0, i + 1).join('.'))) || undefined
}

// A release refuses an entry that still shows a draft's text
const record = (entry: string, drafted: Set<string>) => {
  if (!import.meta.env.DEV && process.env.CELLA_SITE_RELEASE === '1' && drafted.size > 0) {
    throw new Error(`${entry} still shows drafted text (${[...drafted].join(', ')}): write it in src/content/ before a release`)
  }
}

const invalid = (entry: string, error: { issues: { path: PropertyKey[]; message: string }[] }) =>
  new Error(`${entry}: ${error.issues.map((i) => `${i.path.join('.') || '(entry)'} ${i.message}`).join('; ')}; write it in src/content/, or draft it in src/drafts/`)

export async function siteData() {
  const [own] = await getCollection('site')
  const [draft] = await getCollection('siteDrafts')
  const drafted = new Set<string>()
  const parsed = siteSchema.safeParse(merge(own?.data, draft?.data, '', drafted))
  if (!parsed.success) {
    throw invalid('site.yaml', parsed.error)
  }
  record('site.yaml', drafted)
  return { ...parsed.data, drafted: marks(drafted) }
}

export type Rendered = Section & {
  id: string
  drafted: Marks
  Content: Awaited<ReturnType<typeof render>>['Content'] | null
}

/** One section, its operator's file over its draft; its body the
 * operator's unless they left it empty. */
async function compose(id: string, own?: CollectionEntry<'pages'>, draft?: CollectionEntry<'pageDrafts'>): Promise<Rendered> {
  const drafted = new Set<string>()
  const merged = merge(own?.data, draft?.data, '', drafted) as Json
  if (id.endsWith('/hero')) {
    merged.kind = 'hero'
  }
  const parsed = section.safeParse(merged)
  if (!parsed.success) {
    throw invalid(`pages/${id}.mdx`, parsed.error)
  }
  const body = own?.body?.trim() ? own : draft?.body?.trim() ? draft : undefined
  if (body && body === draft) {
    drafted.add('body')
  }
  record(`pages/${id}.mdx`, drafted)
  const Content = body ? (await render(body)).Content : null
  return { ...parsed.data, id: id.split('/')[1], drafted: marks(drafted), Content }
}

/** Every page's name: a folder in the text or the drafts. */
export async function pageNames() {
  const ids = [...(await getCollection('pages')), ...(await getCollection('pageDrafts'))].map((e) => e.id.split('/')[0])
  return [...new Set(ids)].sort()
}

/** A page: its hero and its sections in their order. */
export async function page(name: string) {
  const own = (await getCollection('pages')).filter((e) => e.id.startsWith(`${name}/`))
  const drafts = (await getCollection('pageDrafts')).filter((e) => e.id.startsWith(`${name}/`))
  const ids = [...new Set([...own, ...drafts].map((e) => e.id))]
  const all = await Promise.all(ids.map((id) => compose(id, own.find((e) => e.id === id), drafts.find((e) => e.id === id))))
  const hero = all.find((s) => s.kind === 'hero')
  if (!hero) {
    throw new Error(`pages/${name}/ has no hero.mdx, in src/content/ or src/drafts/`)
  }
  return { hero, sections: all.filter((s) => s !== hero).sort((a, b) => a.order - b.order) }
}

/** The blog's posts, newest first; draft posts only in the dev server. */
export async function posts() {
  return (await getCollection('blog', (p) => import.meta.env.DEV || !p.data.draft)).sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf())
}

export const dated = (d: Date) => d.toLocaleDateString('en', { day: 'numeric', month: 'long', year: 'numeric' })

/** A heading's parts: plain, and thin where it marks them `*so*`. */
export const parts = (heading: string) =>
  heading.split(/(\*[^*]+\*)/).filter(Boolean).map((p) => (p.startsWith('*') && p.endsWith('*') ? { thin: true, text: p.slice(1, -1) } : { thin: false, text: p }))
