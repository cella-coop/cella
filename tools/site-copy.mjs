// The site's copy check (apps/site/index.md, the text): a page, layout or
// component of the site holds structure and no prose. Every word the site
// shows lives in its content collections, under src/content/, so a text
// node, a string literal or a quoted attribute holding a word of copy
// anywhere else fails, named by its file and line. What passes is
// plumbing: an import's path, an identifier-shaped string (an id, a class,
// a collection's name, a path), and the attributes that name or place
// rather than say, an aria-* naming an element the collections label
// among them. An attribute the page renders as its content, set:html or
// set:text, is never plumbing: its value is read as a text node is. It
// reads each file through Astro's own parser.
//
//   node tools/site-copy.mjs <site dir>

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

// Where the structure lives; src/content/ is the text's.
const STRUCTURE = ['src/pages', 'src/layouts', 'src/components']
const SOURCE = /\.(astro|ts|js|mjs)$/

// Attributes whose quoted value is plumbing: it names, places or wires an
// element, and says nothing a reader reads.
const PLUMBING = new Set([
  'id', 'class', 'href', 'src', 'srcset', 'sizes', 'media', 'rel', 'type', 'charset',
  'name', 'lang', 'dir', 'role', 'for', 'slot', 'style', 'target', 'tabindex',
  'loading', 'decoding', 'width', 'height', 'viewBox', 'xmlns', 'fill', 'stroke',
  'is:global', 'is:inline', 'is:raw', 'class:list', 'define:vars',
  // an SVG filter's wiring: its inputs, results, units and operators
  'in', 'in2', 'result', 'operator', 'mode', 'values', 'k1', 'k2', 'k3', 'k4',
  'x', 'y', 'dx', 'dy', 'slope', 'intercept', 'tableValues', 'stdDeviation',
  'filterUnits', 'primitiveUnits', 'color-interpolation-filters', 'preserveAspectRatio',
  // an input's range
  'min', 'max', 'step',
])
// A number, or a list of them, says nothing a reader reads.
const NUMERIC = /^[-+0-9.eE\s,]+$/
// Attributes whose value the page renders as its content: a literal is
// read as a text node, an expression walked as any other.
const CONTENT = new Set(['set:html', 'set:text'])
// An aria-* attribute that says rather than names: its value is read aloud.
const SPOKEN = new Set(['aria-label', 'aria-description', 'aria-roledescription', 'aria-valuetext', 'aria-placeholder'])
// A string shaped as an identifier, a path or a selector: lower case, no
// space. Anything else, a capital, a space, a sentence's stop, is prose.
const IDENT = /^[a-z0-9_./@:?*#=&%+~,\-[\]{}()]*$/
// Elements whose content is code, never copy.
const RAW = new Set(['style', 'script'])

const attrName = (n) => (n.type === 'JSXNamespacedName' ? `${n.namespace.name}:${n.name.name}` : n.name)
const plumbingAttr = (name, element, value) =>
  PLUMBING.has(name) ||
  NUMERIC.test(value) ||
  name.startsWith('data-') ||
  (name.startsWith('aria-') && !SPOKEN.has(name)) ||
  // <meta name="viewport" content="…"> configures; a description's content is copy.
  (name === 'content' && element.attributes.some((a) => a.name && attrName(a.name) === 'name' && a.value?.value === 'viewport'))

/** Astro's parser, as the site's own astro resolves it. */
export async function parser(site) {
  const astro = createRequire(join(site, 'package.json')).resolve('astro/package.json')
  const compiler = createRequire(astro).resolve('@astrojs/compiler-rs')
  return (await import(pathToFileURL(compiler).href)).parse
}

/** Every copy finding in one file's source: `{ line, what }`. */
export function findings(parse, source, ts = false) {
  // A script is parsed as an .astro file's frontmatter, so one walk reads both.
  const offset = ts ? 4 : 0
  const { ast } = parse(ts ? `---\n${source}\n---\n` : source)
  const lineOf = (pos) => source.slice(0, Math.max(0, pos - offset)).split('\n').length
  const out = []
  const say = (node, what) => out.push({ line: lineOf(node.start), what })
  const walk = (node, parent) => {
    if (Array.isArray(node)) return node.forEach((n) => walk(n, parent))
    if (!node || typeof node !== 'object') return
    switch (node.type) {
      case 'JSXElement': {
        const open = node.openingElement
        const tag = open.name.name
        for (const a of open.attributes) {
          if (a.type !== 'JSXAttribute') {
            walk(a, open)
            continue
          }
          const name = attrName(a.name)
          if (a.value?.type === 'Literal') {
            if (CONTENT.has(name)) {
              if (typeof a.value.value === 'string' && a.value.value.trim()) say(a, `the text "${a.value.value.trim()}" is copy`)
            } else if (typeof a.value.value === 'string' && a.value.value.trim() && !plumbingAttr(name, open, a.value.value)) {
              say(a, `the attribute ${name}="${a.value.value}" is copy`)
            }
          } else walk(a.value, a)
        }
        if (!RAW.has(tag)) walk(node.children, node)
        return
      }
      case 'JSXText':
        if (node.value.trim()) say(node, `the text "${node.value.trim()}" is copy`)
        return
      case 'ImportDeclaration':
      case 'ExportAllDeclaration':
      case 'ExportNamedDeclaration':
        // An import's or a re-export's path is plumbing; the rest is read.
        if (node.type === 'ExportNamedDeclaration') walk(node.declaration, node)
        return
      case 'ImportExpression':
        return
      case 'Literal':
        if (typeof node.value === 'string' && !IDENT.test(node.value)) say(node, `the string '${node.value}' is copy`)
        return
      case 'TemplateElement': {
        const text = node.value.cooked ?? node.value.raw
        if (!IDENT.test(text)) say(node, `the template text \`${text}\` is copy`)
        return
      }
      default:
        for (const [k, v] of Object.entries(node)) if (k !== 'type' && v && typeof v === 'object') walk(v, node)
    }
  }
  walk(ast.frontmatter, ast)
  walk(ast.body, ast)
  return out
}

function files(dir) {
  let names
  try {
    names = readdirSync(dir)
  } catch {
    return []
  }
  return names.flatMap((n) => {
    const p = join(dir, n)
    return statSync(p).isDirectory() ? files(p) : SOURCE.test(n) ? [p] : []
  })
}

/** Every finding under the site's structure, as `<path>:<line>: <what>`,
 * read by the site's own parser unless another site's is given. */
export async function check(site, parse) {
  parse ??= await parser(site)
  return STRUCTURE.flatMap((d) => files(join(site, d))).flatMap((f) =>
    findings(parse, readFileSync(f, 'utf8'), !f.endsWith('.astro')).map(({ line, what }) => `${relative(site, f)}:${line}: ${what}`),
  )
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const site = process.argv[2] && resolve(process.argv[2])
  if (!site) {
    console.error('usage: node tools/site-copy.mjs <site dir>')
    process.exit(2)
  }
  const found = await check(site)
  for (const f of found) console.error(f)
  if (found.length) {
    console.error(`${found.length} word(s) of copy outside src/content/: the site's text lives in its collections (apps/site/index.md, the text)`)
    process.exit(1)
  }
  console.log('site copy: every word in src/content/')
}
