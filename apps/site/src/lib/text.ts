// The site's text as every page reads it (index.md, the text). A page is
// the operator's file whole once it exists, and its draft only where they
// have written none. The site's shared text, site.toml, is their entry
// with its draft laid under it, field by field: a field they wrote wins
// whole, one they left out is the draft's. What a draft gives is marked
// drafted, so the dev server underlines it and a release refuses it while
// any remains.
import { getCollection, render } from 'astro:content'
import { site as siteSchema } from '../schemas'

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
    throw invalid('site.toml', parsed.error)
  }
  record('site.toml', drafted)
  return { ...parsed.data, drafted: marks(drafted) }
}

/** Every page's name: a file in the text or the drafts. */
export async function pageNames() {
  const ids = [...(await getCollection('pages')), ...(await getCollection('pageDrafts'))].map((e) => e.id)
  return [...new Set(ids)].sort()
}

/** A page: the operator's file, or its draft where they wrote none, whole
 * and marked drafted; its frontmatter and its body to render. */
export async function page(name: string) {
  const own = (await getCollection('pages')).find((e) => e.id === name)
  const draft = (await getCollection('pageDrafts')).find((e) => e.id === name)
  const entry = own ?? draft
  if (!entry) {
    throw new Error(`there is no page "${name}": write src/content/pages/${name}.mdx`)
  }
  const drafted = !own
  record(`pages/${name}.mdx`, new Set(drafted ? ['the whole page'] : []))
  const { Content } = await render(entry)
  return { ...entry.data, drafted, Content }
}

/** The pages kept from search and from the header's links: an operator's
 * page that says so, or a draft of one they have not written. */
export async function unlisted() {
  const own = await getCollection('pages')
  const drafts = (await getCollection('pageDrafts')).filter((d) => !own.some((e) => e.id === d.id))
  return [...own, ...drafts].filter((e) => e.data.unlisted).map((e) => e.id)
}

/** The blog's posts, newest first; draft posts only in the dev server. */
export async function posts() {
  return (await getCollection('blog', (p) => import.meta.env.DEV || !p.data.draft)).sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf())
}

export const dated = (d: Date) => d.toLocaleDateString('en', { day: 'numeric', month: 'long', year: 'numeric' })

/** A heading's parts: plain, and thin where it marks them `*so*`. */
export const parts = (heading: string) =>
  // a written `\n` breaks the line, as a JSX attribute keeps it literal
  heading.replace(/\\n/g, '\n').split(/(\*[^*]+\*)/).filter(Boolean).map((p) => (p.startsWith('*') && p.endsWith('*') ? { thin: true, text: p.slice(1, -1) } : { thin: false, text: p }))
