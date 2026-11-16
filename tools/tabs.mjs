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

// What one module declares: the pages it owns, with their tabs and the
// tabs its own blocks sit in, and the pages it extends, with whether it
// declares tabs there and the tabs its blocks sit in.
export function pages(file, text) {
  const owned = []
  const extended = []
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
        owned.push({ file, slice, collection, tabs: tabs ? declared(tabs) : [], placed: placed(page) })
      }
      for (const [collection, e] of props(prop(n, 'extends'))) {
        const page = prop(e, 'page')
        if (!collection || !page || !ts.isObjectLiteralExpression(page)) {
          continue
        }
        extended.push({ file, slice, collection, tabs: Boolean(prop(page, 'tabs')), placed: placed(page) })
      }
    }
    ts.forEachChild(n, visit)
  }
  visit(ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS))
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
