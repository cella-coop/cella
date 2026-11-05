// feat check: places every package on the feat tree by its path and refuses
// any dependency the tree does not allow. It reads the manifests cargo and
// pnpm already read, never a list kept by hand.
//
// A node's core holds its libraries, one package each (core/<lib>/rs|ts),
// or is one package itself (core/rs|ts); it is what its feats inherit.
//
//   a package in      may depend on
//   a node's core     its own core's packages; its ancestors' cores
//   a graft           the cores of the feats it joins and of their
//                     ancestors; the grafts at or below its node that join
//                     a proper subset of its feats (the graft order)
//   a node's root     its own core and ancestors' cores, the cores and
//                     roots of the feats below it, the grafts at or below
//                     it
//
// A graft sits at the lowest node whose feats, at any depth, hold every
// feat it joins, and never joins a feat with one nested in it: a child
// inherits its parent's core. A feat's name is unique in its app, since it
// names its schema and the grafts that join it.
//
// It also checks that grafts are named and declared, that a package's
// relative imports stay inside it and its exports are its public surface,
// through ui-check.mjs the client layers' rules, that a feat's or graft's
// actions are named for it and declared only in its models/actions.ts,
// through sql-check.mjs every sql/ file's boundaries,
// through writes.mjs that no feat or graft writes a table it does not own,
// with no exceptions, and through
// powers.mjs that the power each action's label names is the one its SQL
// registers, that a mandate a fixture adopts grants it, and that an
// action with no power declares a check its SQL backs.
// `--no-sql` skips the SQL, which needs the npm install; the flake's check
// runs without one.

import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, dirname, join, relative, resolve } from 'node:path'
import { checkSql, placed, schemaName, undeclared, unowned, unread, definers, unshared } from './sql-check.mjs'
import { agree, covered, declared, granted, mandates } from './powers.mjs'
import { checkUi } from './ui-check.mjs'
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
    return { kind: 'core', node: dirname(dirname(up)) }
  }
  if (basename(dirname(up)) === 'grafts' && isNode(dirname(dirname(up)))) {
    return { kind: 'graft', node: dirname(dirname(up)), name: basename(up) }
  }
  if (isNode(up)) {
    return { kind: 'root', node: up }
  }
  return null
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

// Edges from each ecosystem's manifests.
const edges = []
const byName = new Map()
for (const dir of dirs.filter((d) => existsSync(join(repo, d, 'package.json')))) {
  byName.set(JSON.parse(readFileSync(join(repo, dir, 'package.json'), 'utf8')).name, dir)
}
for (const dir of byName.values()) {
  const pkg = JSON.parse(readFileSync(join(repo, dir, 'package.json'), 'utf8'))
  const deps = { ...pkg.dependencies, ...pkg.devDependencies }
  for (const [name, spec] of Object.entries(deps)) {
    if (String(spec).startsWith('workspace:')) {
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
    fail(`${dir}: not on the tree; a package sits in a node's core/ or core/<lib>/, a graft or a node's root`)
  }
}
for (const [a, b] of edges) {
  const from = place(a)
  const to = place(b)
  if (from && to && !allowed(from, to)) {
    fail(`${describe(from, a)} may not depend on ${describe(to, b)}`)
  }
}

// Grafts: named by the feats they join, two or more in alphabetical order,
// at the lowest node that holds them all, declared by the feat that
// extends.
const nodes = [...new Set(dirs.map(place).filter((p) => p && p.node).map((p) => p.node))]
for (const node of nodes) {
  const kids = childrenOf(node)
  for (const kid of kids) {
    if (basename(kid).includes('-')) {
      fail(`${kid}: a feat's name has no hyphen; hyphens join feats in a graft's name`)
    }
  }
  const gdir = join(repo, node, 'grafts')
  const present = existsSync(gdir) ? readdirSync(gdir) : []
  for (const g of present) {
    const parts = g.split('-')
    if (parts.length < 2 || parts.join('-') !== [...new Set(parts)].sort().join('-')) {
      fail(`${node}/grafts/${g}: a graft is named by two or more distinct feats, in alphabetical order`)
    }
    const joined = parts.map((part) => named(node, part))
    parts.filter((_, i) => !joined[i]).forEach((part) => fail(`${node}/grafts/${g}: joins ${part}, which is not a feat below ${node}`))
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

// Each app: a feat's name is unique in it, at any depth, and every graft a
// feat declares sits at some node of it.
const apps = existsSync(join(repo, 'apps')) ? readdirSync(join(repo, 'apps')).map((a) => join('apps', a)).filter(isNode) : []
for (const app of apps) {
  const seen = new Map()
  for (const d of descendants(app)) {
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
}

// A package's relative imports stay inside it: no reaching into another
// package's files around its manifest.
const sources = (dir, out = []) => {
  for (const name of readdirSync(join(repo, dir))) {
    const path = join(dir, name)
    if (['node_modules', 'build', '.svelte-kit'].includes(name)) {
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
    for (const [, spec] of text.matchAll(/(?:from|import)\s*\(?\s*['"](\.{1,2}\/[^'"]+)['"]/g)) {
      const target = relative(join(repo, dir), resolve(join(repo, dirname(file)), spec))
      if (target.startsWith('..')) {
        fail(`${file}: imports ${spec}, outside its package ${dir}; depend on the package instead`)
      }
    }
  }
}

// The client layers' rules: CSS only in the UI core, state and effects
// only in hooks, no module-level mutable state, no server layer imported
// by a client one, no legacy Svelte or SvelteKit form.
errors.push(...checkUi(repo, [...byName.values()]))

// A package's exports are its public surface: a library's `.`, a slice's
// `./models`, `./api` (its writes, reads and server slice), `./bindings`
// and `./app` (its client slice).
const surface = new Set(['.', './models', './api', './bindings', './app'])
for (const dir of byName.values()) {
  const pkg = JSON.parse(readFileSync(join(repo, dir, 'package.json'), 'utf8'))
  for (const key of Object.keys(pkg.exports ?? {})) {
    if (!surface.has(key)) {
      fail(`${dir}/package.json: exports ${key}; a package exports only ${[...surface].join(', ')}`)
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

if (sql) {
  const known = new Set(['cella'])
  for (const node of nodes) {
    childrenOf(node).forEach((k) => known.add(basename(k)))
    const gdir = join(repo, node, 'grafts')
    for (const g of existsSync(gdir) ? readdirSync(gdir) : []) {
      known.add(schemaName(g))
    }
    // A core library's schema, which its SQL names: org's circle.
    const cdir = join(repo, node, 'core')
    for (const l of existsSync(cdir) ? readdirSync(cdir) : []) {
      if (existsSync(join(cdir, l, 'sql'))) {
        known.add(l)
      }
    }
  }
  const found = { powers: [], guards: [], cites: [], stances: [], personal: [], impersonal: [], columns: [], foreign: [] }
  errors.push(...placed(repo, apps), ...await checkSql(repo, apps, known, found), ...undeclared(found), ...unowned(found), ...unread(found), ...definers(found), ...unshared(found))
  // What a feat's or a graft's TypeScript writes outside its own schema,
  // refused with what its SQL does there.
  for (const dir of byName.values()) {
    const p = place(dir)
    if (p?.kind === 'graft') {
      found.foreign.push(...await scanTs(repo, dir, p.name, schemaName(p.name)))
    } else if (p?.kind === 'core' && parentOf(p.node)) {
      found.foreign.push(...await scanTs(repo, dir, basename(p.node), basename(p.node)))
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
}

if (errors.length) {
  console.error(errors.map((e) => `feat check: ${e}`).join('\n'))
  process.exit(1)
}
console.log(`feat check: ${dirs.length} packages, ${edges.length} edges, ${nodes.length} nodes, all on the tree`)
