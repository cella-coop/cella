// feat check: places every package on the feat tree by its path and refuses
// any dependency the tree does not allow. It reads the manifests cargo and
// pnpm already read, never a list kept by hand.
//
//   a package in      may depend on
//   a shared lib      other shared libs
//   a feat's core     its ancestors' cores; shared libs
//   a graft           the cores of the feats it joins; its node's and
//                     their ancestors' cores; shared libs
//   a node's root     its own core and ancestors' cores, its feats' cores
//                     and roots, its own grafts; shared libs

import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, dirname, join, relative } from 'node:path'

const repo = process.argv[2] ?? process.cwd()
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

// Where a package sits on the tree, from the directory holding its manifest.
const place = (dir) => {
  const up = dirname(dir)
  if (dirname(up) === 'libs') {
    return { kind: 'lib' }
  }
  if (basename(up) === 'core' && isNode(dirname(up))) {
    return { kind: 'core', node: dirname(up) }
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

const allowed = (from, to) => {
  if (to.kind === 'lib') {
    return true
  }
  if (from.kind === 'lib') {
    return false
  }
  const lineage = [from.node, ...ancestors(from.node)]
  if (from.kind === 'core') {
    return to.kind === 'core' && ancestors(from.node).includes(to.node)
  }
  if (from.kind === 'graft') {
    const joined = from.name.split('-').map((f) => join(from.node, 'feats', f))
    return to.kind === 'core' && (lineage.includes(to.node) || joined.includes(to.node))
  }
  const kids = childrenOf(from.node)
  return (to.kind === 'core' && (lineage.includes(to.node) || kids.includes(to.node)))
    || (to.kind === 'root' && kids.includes(to.node))
    || (to.kind === 'graft' && to.node === from.node)
}

// Every package directory: rs/ or ts/ under apps/ and libs/.
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
const dirs = ['apps', 'libs'].filter((d) => existsSync(join(repo, d))).flatMap((d) => walk(d))

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
    fail(`${dir}: not on the tree; a package sits in libs/<lib>/, a node's core/, a graft or a node's root`)
  }
}
for (const [a, b] of edges) {
  const from = place(a)
  const to = place(b)
  if (from && to && !allowed(from, to)) {
    fail(`${describe(from, a)} may not depend on ${describe(to, b)}`)
  }
}

// Grafts: named by the feats they join, declared by the feat that extends.
const nodes = [...new Set(dirs.map(place).filter((p) => p && p.node).map((p) => p.node))]
for (const node of nodes) {
  const kids = childrenOf(node)
  for (const kid of kids) {
    if (basename(kid).includes('-')) {
      fail(`${kid}: a feat's name has no hyphen; hyphens join feats in a graft's name`)
    }
  }
  const declared = new Set(kids.flatMap(grafted))
  const gdir = join(repo, node, 'grafts')
  const present = existsSync(gdir) ? readdirSync(gdir) : []
  for (const g of present) {
    for (const part of g.split('-')) {
      if (!kids.includes(join(node, 'feats', part))) {
        fail(`${node}/grafts/${g}: joins ${part}, which is not a feat of ${node}`)
      }
    }
    if (!declared.has(g)) {
      fail(`${node}/grafts/${g}: no feat of ${node} declares it in its feat.toml`)
    }
  }
  for (const g of declared) {
    if (!present.includes(g)) {
      fail(`${node}: a feat declares graft ${g}, which ${node}/grafts/ does not hold`)
    }
  }
}

if (errors.length) {
  console.error(errors.map((e) => `feat check: ${e}`).join('\n'))
  process.exit(1)
}
console.log(`feat check: ${dirs.length} packages, ${edges.length} edges, ${nodes.length} nodes, all on the tree`)
