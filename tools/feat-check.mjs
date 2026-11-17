// feat check: places every package on the feat tree by its path and refuses
// any dependency the tree does not allow. It reads the manifests cargo and
// pnpm already read, never a list kept by hand.
//
// A node's core holds its libraries, one package each (core/<lib>/rs|ts),
// or is one package itself (core/rs|ts); it is what its feats inherit.
//
//   a package in      may depend on
//   a node's core     its own core's packages; its ancestors' cores; but
//                     a core feat, a core package with SQL of its own
//                     (the notary's aside), is depended on by no other
//                     core feat nor core library, and by a core graft
//                     only if it joins it
//   a graft           the cores of the feats it joins and of their
//                     ancestors; the grafts at or below its node that join
//                     a proper subset of its feats (the graft order)
//   a node's root     its own core and ancestors' cores, the cores and
//                     roots of the feats below it, the grafts at or below
//                     it
//
// The packages in packages/ stand outside the tree. The brand depends on
// no package of the repository, and any package may depend on it; the
// diagrams depend on the brand alone, and only the site depends on them.
// The site, apps/site, stands outside it too: it depends on the brand and
// the diagrams alone, and no package depends on it.
//
// A graft sits at the lowest node whose feats, at any depth, hold every
// feat it joins, and never joins a feat with one nested in it: a child
// inherits its parent's core. Nor does it join a core feat, the circles
// or the people, which every slice reads already. A feat's name is unique in its app, since it
// names its schema and the grafts that join it.
//
// It also checks that grafts are named and declared, that a package's
// relative imports stay inside it and point inward through its layers, its
// exports are its public surface, each export's target in the layer it
// names, that nothing re-exports another package of the tree, that only a
// node's root, a shell, imports a slice's app,
// through ui-check.mjs the client layers' rules, through tabs.mjs that a
// record's page shows at most four tabs, its owner's, that a feat's or graft's
// actions are named for it and declared only in its models/actions.ts,
// through sql-check.mjs every sql/ file's boundaries,
// through writes.mjs that no feat, graft or core library writes a table it
// does not own, that only the notary writes cella.* and only @cella/org-db
// calls its write functions,
// with no exceptions, and through
// powers.mjs that the power each action's label names is the one its SQL
// registers, that a mandate a fixture adopts grants it, that an
// action with no power declares a check its SQL backs, that every
// action folds, and that a feat keeping a body or threads keeps them
// whole.
// `--no-sql` skips the SQL, which needs the npm install; the flake's check
// runs without one.

import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, dirname, join, relative, resolve } from 'node:path'
import { checkSql, placed, schemaName, undeclared, unowned, unread, definers, unshared } from './sql-check.mjs'
import { agree, covered, declared, embodied, granted, mandates, unfolded, unfollowed, whole } from './powers.mjs'
import { checkUi } from './ui-check.mjs'
import { checkTabs } from './tabs.mjs'
import { refuse, scanTs } from './writes.mjs'

const args = process.argv.slice(2)
const sql = !args.includes('--no-sql')
const repo = args.find((a) => !a.startsWith('--')) ?? process.cwd()
const errors = []
const fail = (msg) => errors.push(msg)

const isNode = (dir) => existsSync(join(repo, dir, 'feat.toml'))
const grafted = (dir) => {
  const text = readFileSync(join(repo, dir, 'feat.toml'), 'utf8')
  const m = text.match(/^grafts\s*=\s*\[([^\]]*)\]/m)
  return m ? [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]) : []
}

// The node above a node: nodes nest as <parent>/feats/<child>.
const parentOf = (node) => {
  const up = dirname(dirname(node))
  return basename(dirname(node)) === 'feats' && isNode(up) ? up : null
}
const ancestors = (node) => {
  const out = []
  for (let n = parentOf(node); n; n = parentOf(n)) {
    out.push(n)
  }
  return out
}
const childrenOf = (node) => {
  const dir = join(repo, node, 'feats')
  return existsSync(dir) ? readdirSync(dir).map((c) => join(node, 'feats', c)).filter(isNode) : []
}
const descendants = (node) => childrenOf(node).flatMap((c) => [c, ...descendants(c)])
// The feat below a node a graft's name part names, at any depth.
const named = (node, part) => descendants(node).find((d) => basename(d) === part)
const below = (node, under) => node === under || ancestors(node).includes(under)

// Where a package sits on the tree, from the directory holding its manifest.
const place = (dir) => {
  const up = dirname(dir)
  if (basename(up) === 'core' && isNode(dirname(up))) {
    return { kind: 'core', node: dirname(up) }
  }
  if (basename(dirname(up)) === 'core' && isNode(dirname(dirname(up)))) {
    return { kind: 'core', node: dirname(dirname(up)), lib: basename(up) }
  }
  // A core graft, `core/grafts/<graft>/<lang>`: core, joining core's feats.
  if (basename(dirname(up)) === 'grafts' && basename(dirname(dirname(up))) === 'core' && isNode(dirname(dirname(dirname(up))))) {
    return { kind: 'core', node: dirname(dirname(dirname(up))), graft: basename(up) }
  }
  if (basename(dirname(up)) === 'grafts' && isNode(dirname(dirname(up)))) {
    return { kind: 'graft', node: dirname(dirname(up)), name: basename(up) }
  }
  if (isNode(up)) {
    return { kind: 'root', node: up }
  }
  return null
}

// A core feat: a core package whose directory holds SQL of its own, the
// notary's aside, which is the layer under every slice and no feat.
const coreFeat = (p) => p.kind === 'core' && p.lib && p.lib !== 'notary' && existsSync(join(repo, p.node, 'core', p.lib, 'sql'))
// A node's core feats, by name.
const coreFeats = (node) => {
  const dir = join(repo, node, 'core')
  return existsSync(dir) ? readdirSync(dir).filter((l) => l !== 'grafts' && l !== 'notary' && existsSync(join(dir, l, 'sql'))) : []
}

const describe = (p, dir) => (p ? `${p.kind} ${p.name ?? p.node ?? ''}`.trim() : 'unplaced') + ` (${dir})`

// A graft of lower order: at its node or below, a proper subset of the
// feats.
const lower = (from, to) => {
  const mine = from.name.split('-')
  const theirs = to.name.split('-')
  return below(to.node, from.node) && theirs.length < mine.length && theirs.every((f) => mine.includes(f))
}

const allowed = (from, to) => {
  const lineage = [from.node, ...ancestors(from.node)]
  if (from.kind === 'core') {
    // Core feats sit side by side: none builds on another, nor does a core
    // library, and a core graft builds on the core feats it joins.
    if (to.node === from.node && coreFeat(to) && to.lib !== from.lib) {
      return Boolean(from.graft) && from.graft.split('-').includes(to.lib)
    }
    return to.kind === 'core' && lineage.includes(to.node)
  }
  if (from.kind === 'graft') {
    const joined = from.name.split('-').map((f) => named(from.node, f)).filter(Boolean)
    const cores = joined.flatMap((j) => [j, ...ancestors(j)])
    return (to.kind === 'core' && (lineage.includes(to.node) || cores.includes(to.node)))
      || (to.kind === 'graft' && lower(from, to))
  }
  const under = descendants(from.node)
  return (to.kind === 'core' && (lineage.includes(to.node) || under.includes(to.node)))
    || (to.kind === 'root' && under.includes(to.node))
    || (to.kind === 'graft' && below(to.node, from.node))
}

// Every package directory: rs/ or ts/ under apps/.
const walk = (dir, out = []) => {
  for (const name of readdirSync(join(repo, dir))) {
    const path = join(dir, name)
    if (['node_modules', 'target', '.git'].includes(name) || !statSync(join(repo, path)).isDirectory()) {
      continue
    }
    if (name === 'rs' || name === 'ts') {
      out.push(path)
    }
    walk(path, out)
  }
  return out
}
const dirs = existsSync(join(repo, 'apps')) ? walk('apps') : []
// The packages outside the tree, one to a directory of packages/.
const shared = existsSync(join(repo, 'packages'))
  ? readdirSync(join(repo, 'packages')).map((n) => join('packages', n)).filter((d) => existsSync(join(repo, d, 'package.json')))
  : []
// The site: an app with its manifest at its root and no feat.toml, which
// depends on the packages outside the tree alone, and on which none may.
const sites = existsSync(join(repo, 'apps'))
  ? readdirSync(join(repo, 'apps')).map((a) => join('apps', a)).filter((d) => !isNode(d) && existsSync(join(repo, d, 'package.json')))
  : []

// Edges from each ecosystem's manifests.
const edges = []
const byName = new Map()
for (const dir of [...dirs.filter((d) => existsSync(join(repo, d, 'package.json'))), ...shared, ...sites]) {
  byName.set(JSON.parse(readFileSync(join(repo, dir, 'package.json'), 'utf8')).name, dir)
}
// The workspace package each package's dependencies name, by the name it
// imports them as: a dependency's key, or the package its alias names,
// `"m": "workspace:@cella/org-motion@*"`.
const aliases = new Map()
for (const dir of byName.values()) {
  const pkg = JSON.parse(readFileSync(join(repo, dir, 'package.json'), 'utf8'))
  const deps = { ...pkg.dependencies, ...pkg.devDependencies }
  aliases.set(dir, new Map())
  for (const [key, spec] of Object.entries(deps)) {
    if (String(spec).startsWith('workspace:')) {
      const name = String(spec).match(/^workspace:((?:@[^/@]+\/)?[^/@]+)@/)?.[1] ?? key
      aliases.get(dir).set(key, name)
      byName.has(name) ? edges.push([dir, byName.get(name)]) : fail(`${dir}: depends on ${name}, which is not in the workspace`)
    }
  }
}
if (existsSync(join(repo, 'Cargo.toml'))) {
  const meta = JSON.parse(execFileSync('cargo', ['metadata', '--no-deps', '--offline', '--format-version', '1'], { cwd: repo, encoding: 'utf8' }))
  for (const p of meta.packages) {
    const dir = relative(repo, dirname(p.manifest_path))
    for (const d of p.dependencies.filter((d) => d.path)) {
      edges.push([dir, relative(repo, d.path)])
    }
  }
}

for (const dir of dirs) {
  if (!place(dir)) {
    fail(`${dir}: not on the tree; a package sits in a node's core/, core/<lib>/ or core/grafts/<graft>/, a graft or a node's root`)
  }
}
for (const [a, b] of edges) {
  if (sites.includes(b)) {
    fail(`${a}: depends on ${b}; no package depends on the site`)
    continue
  }
  if (sites.includes(a)) {
    shared.includes(b) || fail(`${a}: depends on ${b}; the site depends on no package of the repository but one outside the tree`)
    continue
  }
  if (shared.includes(a)) {
    if (a !== 'packages/diagrams' || b !== 'packages/brand') {
      fail(`${a}: depends on ${b}; a package outside the tree depends on no package of the repository except diagrams on brand`)
    }
    continue
  }
  if (b === 'packages/diagrams') {
    fail(`${a}: depends on ${b}; only the site depends on the diagrams`)
    continue
  }
  if (shared.includes(b)) {
    continue
  }
  const from = place(a)
  const to = place(b)
  if (from && to && !allowed(from, to)) {
    from.kind === 'core' && to.node === from.node && coreFeat(to)
      ? fail(`${a}: depends on ${b}, the core feat ${to.lib}; ${from.graft ? `core graft ${from.graft} joins no ${to.lib}` : `no core feat nor core library builds on another core feat: a core graft joins them`} (architecture.md, "Core grafts")`)
      : fail(`${describe(from, a)} may not depend on ${describe(to, b)}`)
  }
}

// Grafts: named by the feats they join, two or more in alphabetical order,
// at the lowest node that holds them all, declared by the feat that
// extends.
const nodes = [...new Set(dirs.map(place).filter((p) => p && p.node).map((p) => p.node))]
for (const node of nodes) {
  const kids = childrenOf(node)
  const gdir = join(repo, node, 'grafts')
  const present = existsSync(gdir) ? readdirSync(gdir) : []
  for (const g of present) {
    const parts = g.split('-')
    if (parts.length < 2 || parts.join('-') !== [...new Set(parts)].sort().join('-')) {
      fail(`${node}/grafts/${g}: a graft is named by two or more distinct feats, in alphabetical order`)
    }
    const joined = parts.map((part) => named(node, part))
    // A core feat, the circles or the people, is every slice's to read:
    // no graft joins one.
    const cores = new Set([node, ...ancestors(node)].flatMap((n) => coreFeats(n)))
    parts.filter((part, i) => !joined[i] && cores.has(part)).forEach((part) => fail(`${node}/grafts/${g}: joins ${part}, a core feat, which every feat and graft reads already; no graft joins core (architecture.md, "People are core")`))
    parts.filter((part, i) => !joined[i] && !cores.has(part)).forEach((part) => fail(`${node}/grafts/${g}: joins ${part}, which is not a feat below ${node}`))
    const found = joined.filter(Boolean)
    for (const a of found) {
      for (const b of found.filter((b) => b !== a && below(b, a))) {
        fail(`${node}/grafts/${g}: joins ${basename(a)} and ${basename(b)}, nested in it; a child inherits its parent's core`)
      }
    }
    const lowest = kids.find((k) => found.length === parts.length && found.every((f) => below(f, k)))
    if (lowest) {
      fail(`${node}/grafts/${g}: every feat it joins is below ${lowest}; a graft sits at the lowest node that holds them all`)
    }
    if (!found.some((f) => grafted(f).includes(g))) {
      fail(`${node}/grafts/${g}: no feat it joins declares it in its feat.toml`)
    }
  }
  for (const kid of kids) {
    for (const g of grafted(kid).filter((g) => !g.split('-').includes(basename(kid)))) {
      fail(`${kid}: declares ${g}, which does not join it; the feat that extends declares a graft`)
    }
  }
}

// Each app: a feat's name is unique in it, at any depth, and has no
// hyphen, and every graft a feat declares sits at some node of it.
const apps = existsSync(join(repo, 'apps')) ? readdirSync(join(repo, 'apps')).map((a) => join('apps', a)).filter(isNode) : []
for (const app of apps) {
  const seen = new Map()
  for (const d of descendants(app)) {
    if (basename(d).includes('-')) {
      fail(`${d}: a feat's name has no hyphen; hyphens join feats in a graft's name`)
    }
    seen.has(basename(d))
      ? fail(`${d}: a feat's name is unique in its app, and ${seen.get(basename(d))} holds it already`)
      : seen.set(basename(d), d)
  }
  const held = new Set([app, ...descendants(app)].flatMap((n) => {
    const d = join(repo, n, 'grafts')
    return existsSync(d) ? readdirSync(d) : []
  }))
  for (const d of descendants(app)) {
    for (const g of grafted(d).filter((g) => !held.has(g))) {
      fail(`${d}: declares graft ${g}, which no node of ${app} holds`)
    }
  }
  // Each e2e scenario's `// covers:` line names slices of the app, its
  // feats and grafts, or `all`, or `core` for the core's alone; and a
  // scenario that drives the shell, importing `./browser.ts` or
  // `./serve.ts` itself or through a helper beside it, has one, since its
  // imports do not say whose pages it drives (architecture.md, "Tests").
  const e2e = join(app, 'ts/_e2e')
  const slices = new Set([...held, ...descendants(app).map((d) => basename(d)), 'all', 'core'])
  const helpers = (file) => [...readFileSync(join(repo, e2e, file), 'utf8').matchAll(/(?:from|import)\s*\(?\s*['"]\.\/([^'"]+)['"]/g)].map((m) => m[1])
  const drives = (file, seen = new Set()) => {
    seen.add(file)
    return helpers(file).some((h) => h === 'browser.ts' || h === 'serve.ts' || (!seen.has(h) && existsSync(join(repo, e2e, h)) && drives(h, seen)))
  }
  for (const file of existsSync(join(repo, e2e)) ? readdirSync(join(repo, e2e)).filter((f) => f.endsWith('.test.ts')).sort() : []) {
    const covers = readFileSync(join(repo, e2e, file), 'utf8').match(/^\/\/ covers: (.*)$/m)
    for (const name of covers ? covers[1].split(/\s+/).filter(Boolean) : []) {
      if (!slices.has(name)) {
        fail(`${e2e}/${file}: covers ${name}, a slice ${app} lacks`)
      }
    }
    if (!covers && drives(file)) {
      fail(`${e2e}/${file}: drives the shell and has no \`// covers: <slice> …\` line naming the slices whose pages it drives`)
    }
  }
}

// A package's relative imports stay inside it: no reaching into another
// package's files around its manifest. Inside it, a file in a layer,
// src/<layer>/, imports only its own layer and the layers inside it,
// server then client, innermost first; a client layer's import of a
// server one is ui-check's to refuse. A file in no layer, or an import of
// one, is held by no layer's rule.
const layers = ['models', 'interfaces', 'handlers', 'drivers', 'api', 'hooks', 'components', 'bindings', 'app']
const layer = (path) => path.match(/^src\/([^/]+)\//)?.[1]
const sources = (dir, out = []) => {
  for (const name of readdirSync(join(repo, dir))) {
    const path = join(dir, name)
    if (['node_modules', 'build', '.svelte-kit', 'dist', '.astro'].includes(name)) {
      continue
    }
    if (statSync(join(repo, path)).isDirectory()) {
      sources(path, out)
    } else if (/\.(ts|mts|js|mjs|svelte)$/.test(name)) {
      out.push(path)
    }
  }
  return out
}
for (const dir of byName.values()) {
  for (const file of sources(dir)) {
    const text = readFileSync(join(repo, file), 'utf8')
    const own = layer(relative(join(repo, dir), join(repo, file)))
    for (const [, spec] of text.matchAll(/(?:from|import)\s*\(?\s*['"](\.{1,2}\/[^'"]+)['"]/g)) {
      const target = relative(join(repo, dir), resolve(join(repo, dirname(file)), spec))
      const to = layer(target)
      if (target.startsWith('..')) {
        fail(`${file}: imports ${spec}, outside its package ${dir}; depend on the package instead`)
      } else if (layers.includes(own) && layers.indexOf(to) > layers.indexOf(own)) {
        fail(`${file}: imports ${spec}, in ${to}, a layer outside its own ${own}; imports point inward, ${layers.join(' → ')}`)
      }
    }
  }
}

// The client layers' rules: CSS only in the UI core, state and effects
// only in hooks, no module-level mutable state, no server layer imported
// by a client one, no legacy Svelte or SvelteKit form.
const onTree = [...byName.values()].filter((d) => !shared.includes(d) && !sites.includes(d))
errors.push(...checkUi(repo, onTree))

// A record's page shows at most four tabs, which the slice owning its
// collection chooses; an extension places its blocks in them and
// declares none of its own.
errors.push(...checkTabs(repo, onTree))

// A package's exports are its public surface: a library's `.`, a slice's
// `./models`, `./api` (its writes, reads and server slice), `./bindings`
// and `./app` (its client slice), each export's target inside the layer
// its key names, `src/<layer>/`, and a library's anywhere inside it.
const surface = new Set(['.', './models', './api', './bindings', './app'])
// The paths a manifest's value names, through its conditions.
const leaves = (v) => (typeof v === 'string' ? [v] : v && typeof v === 'object' ? Object.values(v).flatMap(leaves) : [])
const manifest = (dir) => JSON.parse(readFileSync(join(repo, dir, 'package.json'), 'utf8'))
for (const dir of onTree) {
  const pkg = manifest(dir)
  const exports = typeof pkg.exports === 'string' ? { '.': pkg.exports } : (pkg.exports ?? {})
  for (const [key, value] of Object.entries(exports)) {
    if (!surface.has(key)) {
      fail(`${dir}/package.json: exports ${key}; a package exports only ${[...surface].join(', ')}`)
      continue
    }
    const home = key === '.' ? '' : `src/${key.slice(2)}/`
    for (const target of leaves(value)) {
      const at = relative(join(repo, dir), resolve(join(repo, dir), target))
      if (at.startsWith('..') || !at.startsWith(home)) {
        fail(`${dir}/package.json: exports ${key} as ${target}, outside ${home || 'the package'}; an export's target sits in the layer its key names`)
      }
    }
  }
}

// Nothing re-exports around the tree, and only a shell imports a slice's
// app. Each import is resolved to the package it names, through the
// dependency's alias and the package's `imports` (`#lib/*`), a conditional
// entry to every target it names; a module that re-exports a module of
// another package of the tree, by `export … from` or by exporting a name it
// imported, is refused, as is an import of a slice's `./app` by any package
// but a node's root. A library holds no data and is no slice: its subpaths
// are open to what may depend on it.
const slice = (p) => Boolean(p) && (p.kind === 'graft' || (p.kind === 'core' && Boolean(p.graft || coreFeat(p) || (!p.lib && parentOf(p.node)))))
// The targets a `#` specifier maps to, every one its conditions name.
const mapped = (imports, spec) => {
  for (const [key, value] of Object.entries(imports ?? {})) {
    const targets = leaves(value)
    const [head, tail] = key.split('*')
    if (key === spec) {
      return targets
    }
    if (tail !== undefined && targets.length && spec.startsWith(head) && spec.endsWith(tail) && spec.length >= head.length + tail.length) {
      return targets.map((t) => t.replace('*', spec.slice(head.length, spec.length - tail.length)))
    }
  }
  return []
}
// The packages of the tree a bare specifier reaches from `dir`, each with
// its subpath: a dependency's one, or one for each target of a `#` import
// that names a package.
const reach = (dir, pkg, spec) =>
  (spec.startsWith('#') ? mapped(pkg.imports, spec).filter((t) => !t.startsWith('.')) : [spec]).flatMap((s) => {
    const m = s.match(/^((?:@[^/]+\/)?[^/]+)(\/.*)?$/)
    const name = m && (aliases.get(dir).get(m[1]) ?? (m[1] === pkg.name ? pkg.name : null))
    const to = name && byName.get(name)
    return to && onTree.includes(to) ? [{ name, to, sub: `.${m[2] ?? ''}` }] : []
  })
// The local names an import clause binds: `X`, `{ a, b as c }`, `* as N`.
const bound = (clause) =>
  clause.replace(/[{}]/g, ',').split(',').map((s) => s.trim().replace(/^type\s+/, '').replace(/^\*\s+as\s+/, '').split(/\s+as\s+/).pop()).filter((s) => /^[\w$]+$/.test(s))
for (const dir of onTree) {
  const pkg = manifest(dir)
  const shell = place(dir)?.kind === 'root'
  for (const [key, value] of Object.entries(pkg.imports ?? {})) {
    for (const target of leaves(value).filter((t) => t.startsWith('.'))) {
      if (relative(join(repo, dir), resolve(join(repo, dir), target)).startsWith('..')) {
        fail(`${dir}/package.json: imports ${key} as ${target}, outside its package; depend on the package instead`)
      }
    }
  }
  for (const file of sources(dir)) {
    const text = readFileSync(join(repo, file), 'utf8')
    const foreign = (spec) => reach(dir, pkg, spec).filter((r) => r.name !== pkg.name)
    for (const [, spec] of text.matchAll(/(?:\bfrom|\bimport)\s*\(?\s*['"]([^'".][^'"]*)['"]/g)) {
      for (const r of foreign(spec)) {
        if (!shell && slice(place(r.to)) && (r.sub === './app' || r.sub.startsWith('./app/'))) {
          fail(`${file}: imports ${spec}, the app of ${r.name}; only a shell imports a slice's app, so use its contract, what it shares in ./bindings`)
        }
      }
    }
    for (const [, spec] of text.matchAll(/\bexport\s+(?:type\s+)?(?:\*(?:\s+as\s+[\w$]+)?|\{[^}]*\})\s*from\s*['"]([^'"]+)['"]/g)) {
      for (const name of new Set(foreign(spec).map((r) => r.name))) {
        fail(`${file}: re-exports ${spec}, of ${name}; nothing re-exports another package of the tree, so import it from the package that owns it`)
      }
    }
    const imported = new Map()
    for (const [, clause, spec] of text.matchAll(/\bimport\s+(?:type\s+)?([^'"]*?)\s*from\s*['"]([^'"]+)['"]/g)) {
      if (foreign(spec).length) {
        bound(clause).forEach((n) => imported.set(n, spec))
      }
    }
    const exported = [
      ...[...text.matchAll(/\bexport\s+(?:type\s+)?\{([^}]*)\}(?!\s*from\b)/g)].flatMap(([, list]) => list.split(',').map((s) => s.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0])),
      ...[...text.matchAll(/\bexport\s+default\s+([\w$]+)\s*;?\s*$/gm)].map(([, n]) => n),
    ]
    for (const n of new Set(exported.filter((n) => imported.has(n)))) {
      fail(`${file}: re-exports ${n}, imported from ${imported.get(n)}; nothing re-exports another package of the tree, so import it from the package that owns it`)
    }
  }
}

// A feat's or graft's actions are declared in its `models/actions.ts` and
// nowhere else: no other file imports a label or the `Actions` type, and
// no `models/ops.ts` is left. Each action is its own,
// `<feat>:<entity>:<verb>`. A library of the app's core that has actions,
// as `circle` does, is held to the same, its actions named for it.
const acts = (dir) => existsSync(join(repo, dir, 'src', 'models', 'actions.ts'))
const appCore = (p) => p?.kind === 'core' && !parentOf(p.node)
const labels = /import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*['"]@cella\/org-actions['"]/g
const declares = (text) =>
  [...text.matchAll(labels)].some(([, names]) =>
    names.split(',').some((n) => ['confluent', 'bounded', 'ordered', 'Actions'].includes(n.replace(/^\s*type\s+/, '').trim())))
for (const dir of byName.values()) {
  const p = place(dir)
  if (!p || (appCore(p) && !acts(dir))) {
    continue
  }
  const own = join(dir, 'src', 'models', 'actions.ts')
  for (const file of sources(dir).filter((f) => f !== own)) {
    if (file === join(dir, 'src', 'models', 'ops.ts')) {
      fail(`${file}: actions are declared in models/actions.ts`)
    } else if (declares(readFileSync(join(repo, file), 'utf8'))) {
      fail(`${file}: declares an action outside ${own}`)
    }
  }
  if (!existsSync(join(repo, own))) {
    continue
  }
  const name = p.kind === 'graft' ? p.name : appCore(p) ? basename(dirname(dir)) : basename(p.node)
  for (const [, action] of readFileSync(join(repo, own), 'utf8').matchAll(/^\s*'([^']+)':/gm)) {
    if (action.split(':').length !== 3 || action.split(':')[0] !== name) {
      fail(`${own}: ${action} is not an action of ${name}, <${name}>:<entity>:<verb>`)
    }
  }
}

// How many actions there are, every one of which folds.
let actionCount = 0

if (sql) {
  const known = new Set(['cella'])
  for (const node of nodes) {
    childrenOf(node).forEach((k) => known.add(basename(k)))
    const gdir = join(repo, node, 'grafts')
    for (const g of existsSync(gdir) ? readdirSync(gdir) : []) {
      known.add(schemaName(g))
    }
    // A core library's schema, which its SQL names: org's circle; and a
    // core graft's: org's circle_policy.
    const cdir = join(repo, node, 'core')
    for (const l of existsSync(cdir) ? readdirSync(cdir) : []) {
      if (existsSync(join(cdir, l, 'sql'))) {
        known.add(l)
      }
    }
    for (const g of existsSync(join(cdir, 'grafts')) ? readdirSync(join(cdir, 'grafts')) : []) {
      known.add(schemaName(g))
    }
  }
  const found = { powers: [], guards: [], cites: [], stances: [], personal: [], impersonal: [], columns: [], foreign: [], follows: [] }
  errors.push(...placed(repo, apps), ...await checkSql(repo, apps, known, found), ...undeclared(found), ...unowned(found), ...unread(found), ...definers(found), ...unshared(found))
  // What a feat's, a graft's, a core library's or the shell's TypeScript
  // writes outside its own schema, refused with what its SQL does there;
  // what it writes in cella.*, but the notary's; and a call of the
  // notary's write functions, but @cella/org-db's.
  for (const [name, dir] of byName) {
    const p = place(dir)
    const writer = name === '@cella/org-db'
    if (p?.kind === 'graft') {
      found.foreign.push(...await scanTs(repo, dir, p.name, schemaName(p.name)))
    } else if (p?.kind === 'core' && parentOf(p.node)) {
      found.foreign.push(...await scanTs(repo, dir, basename(p.node), basename(p.node)))
    } else if (p?.kind === 'core') {
      const lib = basename(dirname(dir)) === 'core' ? basename(p.node) : basename(dirname(dir))
      found.foreign.push(...await scanTs(repo, dir, lib, schemaName(lib), { notary: lib === 'notary', writer }))
    } else if (p?.kind === 'root') {
      // The shell owns no schema and writes no SQL: every write in its
      // src is refused, of a slice's table or of cella.*.
      found.foreign.push(...await scanTs(repo, dir, name, null))
    }
  }
  errors.push(...refuse(found.foreign))
  // A feat's or graft's ops, and those of a core library that has
  // actions, not the app core's own types.
  const owned = [...byName.values()].filter((d) => {
    const p = place(d)
    return p && !(appCore(p) && !acts(d))
  })
  const ops = await declared(repo, owned)
  errors.push(...agree(ops, found.powers, found.cites, found.stances), ...covered(ops, found))
  // Every action's fold: one with none is refused, as one with no power
  // is (architecture.md, "Folds").
  errors.push(...unfolded(ops, found.folds ?? []))
  actionCount = ops.length
  // A feat's body or threads kept whole: their commands, powers, folds,
  // the mention table, the reaction guard and the session's mount.
  const feats = [...byName.values()]
    .map((d) => [d, place(d)])
    .filter(([, p]) => p?.kind === 'core' && parentOf(p.node) && !p.lib && !p.graft)
    .map(([d, p]) => {
      const api = join(repo, d, 'src', 'api')
      // A feat mounts one body per kind it keeps one for; several where
      // more than one of its collections does, as account's and
      // patronage's do.
      const mounts = existsSync(api)
        ? readdirSync(api).reduce((n, f) => n + (readFileSync(join(api, f), 'utf8').match(/^\s+body:\s*[{\w]/gm) ?? []).length, 0)
        : 0
      return { name: basename(p.node), dir: d, file: join(d, 'src', 'models', 'actions.ts'), mounts }
    })
  errors.push(...whole(feats, ops, found))
  errors.push(...embodied(repo, feats))
  // The mandates each app's fixtures adopt, which every power must be
  // among.
  const { parse } = await import('smol-toml')
  const grants = []
  for (const app of apps) {
    const dir = join(repo, app, 'fixtures')
    for (const name of existsSync(dir) ? readdirSync(dir) : []) {
      const file = join(dir, name, 'motion.toml')
      if (existsSync(file)) {
        grants.push(...mandates(parse(readFileSync(file, 'utf8')).motion, name))
      }
    }
  }
  errors.push(...granted(ops, grants, found.stances))
  // Each op a slice reacts to (`on`) is one a row of `cella.follows` its
  // own SQL registers lets an effect follow.
  const reacting = []
  for (const dir of byName.values()) {
    const p = place(dir)
    const owner = p?.kind === 'graft' ? p.name : p?.kind === 'core' ? basename(p.node) : null
    for (const file of owner ? sources(dir) : []) {
      reacting.push({ file, owner, text: readFileSync(join(repo, file), 'utf8') })
    }
  }
  errors.push(...unfollowed(reacting, found.follows))
}

if (errors.length) {
  console.error(errors.map((e) => `feat check: ${e}`).join('\n'))
  process.exit(1)
}
const folded = sql ? `, all ${actionCount} actions fold` : ''
console.log(`feat check: ${dirs.length} packages, ${edges.length} edges, ${nodes.length} nodes, all on the tree, ${shared.length + sites.length} outside it${folded}`)
