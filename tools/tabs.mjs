// tabs check: a record's page shows at most four tabs, and the slice
// that owns the record's collection chooses them, in order. An extension
// places its blocks in a tab its owner's page names, and declares no tab
// of its own; what its owner gives no tab is a jump in the drawer's
// Related, which the shell draws from every collection whose rows name
// the record. The feat check runs it over every slice's client app, the
// modules under `src/app/` that declare an `App`, read by their syntax:
// an `App` literal's `collections` and `extends`, each one's `page`,
// its `tabs` and every block's `tab`.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import ts from 'typescript'

// The most tabs a record's page shows.
export const MOST = 4

const key = (name) => (ts.isIdentifier(name) || ts.isStringLiteral(name) ? name.text : null)

const props = (o) =>
  o && ts.isObjectLiteralExpression(o) ? o.properties.filter(ts.isPropertyAssignment).map((p) => [key(p.name), p.initializer]) : []

const prop = (o, name) => props(o).find(([k]) => k === name)?.[1]

// Every block's tab in a page's subtree, `tab: '<id>'` wherever it is
// set, a block mapped into a tab among them.
function placed(node) {
  const out = []
  const visit = (n) => {
    if (ts.isPropertyAssignment(n) && key(n.name) === 'tab' && (ts.isStringLiteral(n.initializer) || ts.isNoSubstitutionTemplateLiteral(n.initializer))) {
      out.push(n.initializer.text)
    }
    ts.forEachChild(n, visit)
  }
  visit(node)
  return out
}

// A page's declared tabs, by id, or null where they are not a list of
// literals the check can read.
function declared(tabs) {
  if (!ts.isArrayLiteralExpression(tabs)) {
    return null
  }
  const ids = tabs.elements.map((t) => prop(t, 'id')).map((id) => (id && (ts.isStringLiteral(id) || ts.isNoSubstitutionTemplateLiteral(id)) ? id.text : null))
  return ids.every((id) => id !== null) ? ids : null
}

// A page's blocks as the layout check reads them: each a component's
// name, imported by the module, and the tab it names, null for a bare
// one, which sits in the first; `name` is null where the block is not a
// name or a `{ tab, block }` literal naming one.
function entries(blocks) {
  if (!blocks) {
    return []
  }
  if (!ts.isArrayLiteralExpression(blocks)) {
    return [{ name: null, tab: null }]
  }
  return blocks.elements.map((b) => {
    if (ts.isIdentifier(b)) {
      return { name: b.text, tab: null }
    }
    const tab = prop(b, 'tab')
    const block = prop(b, 'block')
    return {
      name: block && ts.isIdentifier(block) ? block.text : null,
      tab: tab && (ts.isStringLiteral(tab) || ts.isNoSubstitutionTemplateLiteral(tab)) ? tab.text : null,
    }
  })
}

// A module's default imports, by the name each binds.
function imported(source) {
  const out = new Map()
  for (const s of source.statements) {
    if (ts.isImportDeclaration(s) && s.importClause?.name && ts.isStringLiteral(s.moduleSpecifier)) {
      out.set(s.importClause.name.text, s.moduleSpecifier.text)
    }
  }
  return out
}

// What one module declares: the pages it owns, with their tabs and the
// tabs its own blocks sit in, and the pages it extends, with whether it
// declares tabs there and the tabs its blocks sit in. For the layout
// check, each page's blocks by name, and an owned page's layout and body,
// with the module's default imports.
export function pages(file, text) {
  const owned = []
  const extended = []
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const imports = imported(source)
  const literal = (e) => (e && (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) ? e.text : e ? null : undefined)
  const visit = (n) => {
    if (ts.isObjectLiteralExpression(n) && (prop(n, 'collections') || prop(n, 'extends'))) {
      const name = prop(n, 'name')
      const slice = name && ts.isStringLiteral(name) ? name.text : file
      for (const [collection, c] of props(prop(n, 'collections'))) {
        const page = prop(c, 'page')
        if (!collection || !page || !ts.isObjectLiteralExpression(page)) {
          continue
        }
        const tabs = prop(page, 'tabs')
        const body = prop(page, 'body')
        owned.push({
          file,
          slice,
          collection,
          tabs: tabs ? declared(tabs) : [],
          placed: placed(page),
          layout: literal(prop(page, 'layout')),
          body: body ? (ts.isIdentifier(body) ? body.text : null) : undefined,
          blocks: entries(prop(page, 'blocks')),
          imports,
        })
      }
      for (const [collection, e] of props(prop(n, 'extends'))) {
        const page = prop(e, 'page')
        if (!collection || !page || !ts.isObjectLiteralExpression(page)) {
          continue
        }
        extended.push({ file, slice, collection, tabs: Boolean(prop(page, 'tabs')), placed: placed(page), blocks: entries(prop(page, 'blocks')), imports })
      }
    }
    ts.forEachChild(n, visit)
  }
  visit(source)
  return { owned, extended }
}

const fix = 'keep a tab only where its data is a genuinely different view of the record, and leave every other extender to Related'

// The refusals over every module's declarations, `sources` a list of
// `{ file, text }`: a page declaring more than four tabs, or tabs the
// check cannot read; an extension declaring a tab; a block, the owner's
// or an extension's, in a tab its owner's page does not name.
export function problems(sources) {
  const all = sources.map(({ file, text }) => pages(file, text))
  const owners = new Map(all.flatMap((p) => p.owned).map((o) => [o.collection, o]))
  const out = []
  for (const o of owners.values()) {
    if (o.tabs === null) {
      out.push(`${o.file}: ${o.slice}'s ${o.collection} page declares its tabs other than as a list of { id, label } literals, which the tabs check reads`)
      continue
    }
    if (o.tabs.length > MOST) {
      out.push(`${o.file}: ${o.slice}'s ${o.collection} page declares ${o.tabs.length} tabs (${o.tabs.join(', ')}); a record's page shows at most ${MOST}: ${fix}`)
    }
  }
  const named = (o) => (o.tabs?.length ? o.tabs.join(', ') : 'none but its first')
  for (const o of owners.values()) {
    for (const t of new Set(o.placed)) {
      if (o.tabs && !o.tabs.includes(t)) {
        out.push(`${o.file}: ${o.slice} places a block of the ${o.collection} page in the tab ${t}, which the page does not declare (${named(o)}); declare it among the page's tabs`)
      }
    }
  }
  for (const e of all.flatMap((p) => p.extended)) {
    const o = owners.get(e.collection)
    if (e.tabs) {
      out.push(
        `${e.file}: ${e.slice} adds a tab of its own to the ${e.collection} page; the page's owner${o ? `, ${o.slice},` : ''} chooses its tabs: place its blocks in one it names${o ? ` (${named(o)})` : ''}, or leave its collection a jump in Related`,
      )
    }
    for (const t of new Set(e.placed)) {
      if (o?.tabs && !o.tabs.includes(t)) {
        out.push(
          `${e.file}: ${e.slice} places a block in the ${e.collection} page's tab ${t}, which its owner, ${o.slice}, does not name (${named(o)}); place it in one the owner names, or have the owner name the tab, or leave its collection a jump in Related`,
        )
      }
    }
  }
  return out
}

// The modules of a package's client app: every `.ts` under `src/app/`
// but a state class.
const modules = (repo, dir, out = []) => {
  let names
  try {
    names = readdirSync(join(repo, dir))
  } catch {
    return out
  }
  for (const name of names) {
    const path = join(dir, name)
    if (statSync(join(repo, path)).isDirectory()) {
      modules(repo, path, out)
    } else if (name.endsWith('.ts') && !name.endsWith('.svelte.ts') && !name.endsWith('.d.ts')) {
      out.push(path)
    }
  }
  return out
}

// The check over every package's client app, `dirs` the packages.
export function checkTabs(repo, dirs) {
  const sources = dirs.flatMap((dir) =>
    modules(repo, join(dir, 'src', 'app')).map((path) => ({ file: relative(repo, join(repo, path)), text: readFileSync(join(repo, path), 'utf8') })),
  )
  return problems(sources)
}
