// Numbers a page's sections at build (index.md, the layout), so a page lays
// itself out by the order it is written in. Before a page's or a post's
// MDX is compiled, each of its top-level components, written at the start
// of a line, is told where it stands: the `Hero` its page, and each
// `Section` and `Band` its page, its `place` among them, from which it
// takes its side, its `turn`, the ink its photo takes, one on for every
// section with a photo before it, and, where it asks for a ghost numeral,
// its `numeral`, counted among those that ask. It rewrites the source as
// it is compiled, never the file.

const PLACED = new Set(['Section', 'Band'])

/** A page's name from its file: `pages/<name>.mdx`; a post's is the blog's. */
export function pageOf(path: string) {
  const m = path.match(/\/src\/(?:content|drafts)\/(pages|blog)\/([^/]+)\.mdx$/)
  if (!m) {
    return undefined
  }
  return m[1] === 'blog' ? 'blog' : m[2]
}

/** Where an opening tag that starts at `from` ends: its closing `>`, past
 * any quoted value or braced expression. */
function close(src: string, from: number) {
  let depth = 0
  let quote = ''
  for (let i = from; i < src.length; i++) {
    const c = src[i]
    if (quote) {
      if (c === quote) {
        quote = ''
      }
    } else if (c === '"' || c === "'") {
      quote = c
    } else if (c === '{') {
      depth++
    } else if (c === '}') {
      depth--
    } else if (c === '>' && depth === 0) {
      return i
    }
  }
  return src.length
}

/** The source with its top-level sections told where they stand: those
 * not inside another, by the tags that open and close them. */
export function number(src: string, page: string) {
  const tag = /^<(\/?)(Hero|Section|Band)(?=[\s/>])/gm
  let out = ''
  let last = 0
  let depth = 0
  let place = 0
  let turn = 1
  let numeral = 0
  for (const m of src.matchAll(tag)) {
    if (m[1]) {
      depth--
      continue
    }
    const name = m[2]
    const at = m.index + m[0].length
    const end = close(src, at)
    const open = src.slice(at, end)
    const nested = depth > 0
    if (src[end - 1] !== '/') {
      depth++
    }
    if (nested) {
      continue
    }
    const given = (attr: string) => new RegExp(`(^|\\s)${attr}(?=[\\s=/>]|$)`).test(open)
    const said = [`page="${page}"`]
    if (PLACED.has(name)) {
      said.push(`place="${place++}"`, `turn="${turn}"`)
      if (given('photo')) {
        turn++
      }
      if (given('ghost')) {
        said.push(`numeral="${++numeral}"`)
      }
    }
    out += `${src.slice(last, at)} ${said.join(' ')}`
    last = at
  }
  return out + src.slice(last)
}

/** The Vite plugin that numbers every page's and post's sections. */
export function sections() {
  return {
    name: 'cella-sections',
    enforce: 'pre' as const,
    transform(code: string, id: string) {
      const page = pageOf(id.split('?')[0])
      if (!page) {
        return null
      }
      return { code: number(code, page), map: null }
    },
  }
}
