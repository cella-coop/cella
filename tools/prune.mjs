// prune: copies the org app with every slice above core removed, the tree
// `cella check pruned` builds and `cella test pruned` serves, to prove
// every feat outside core can be removed (architecture.md, "Removing a
// feat"). Into a fresh directory it copies what the org app is built
// from, the root's manifests, `apps/org`, the brand and the tools, but
// leaves out:
//
//   apps/org/feats/, apps/org/grafts/   every feat and graft of the app
//   apps/org/ts/_e2e/                   the scenarios across them
//   apps/org/ts/src/lib/server/feats/   the shell's composition root above
//   apps/org/ts/src/lib/feats/          core, each emptied to a list of none
//
// It drops every workspace dependency on a package it left out from each
// manifest it copies, and refuses a package it keeps that still imports
// one, by a bare specifier in any of its source files: a core package or
// the shell that names a slice above core cannot stand without it. Core's
// SQL that reaches past core fails the pruned tree's migration, and a
// registration or a required effect only a feat makes, its sign-in.
//
// node tools/prune.mjs <repo> <into>

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync, copyFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'

const [repo, into] = process.argv.slice(2)
if (!repo || !into) {
  console.error('usage: node tools/prune.mjs <repo> <into>')
  process.exit(2)
}

// What the org app is built from, and what of it is above core.
const KEPT = ['apps/org', 'packages/brand', 'tools']
const PRUNED = ['apps/org/feats', 'apps/org/grafts', 'apps/org/ts/_e2e', 'apps/org/ts/src/lib/server/feats', 'apps/org/ts/src/lib/feats']
// What no build reads: installs, builds and the dev cluster's data.
const SKIPPED = new Set(['node_modules', 'target', '.data', '.git', '.svelte-kit', 'build', 'dist'])
const SOURCE = /\.(ts|mts|js|mjs|svelte)$/

// The composition root's halves above core, emptied.
const EMPTIED = {
  'apps/org/ts/src/lib/server/feats/index.ts': [
    "import type { Slice } from '@cella/org-db'",
    '',
    '// Pruned: no slice above core (tools/prune.mjs).',
    'export const root: Slice | undefined = undefined',
    'export const feats: Slice[] = []',
    '',
  ],
  'apps/org/ts/src/lib/feats/index.ts': [
    "import type { App } from '@cella/org-ui'",
    '',
    '// Pruned: no slice above core (tools/prune.mjs).',
    'export const feats: App[] = []',
    '',
  ],
}

const isDir = (p) => existsSync(p) && statSync(p).isDirectory()
const pruned = (rel) => PRUNED.some((p) => rel === p || rel.startsWith(`${p}/`))

function walk(dir, out, keep) {
  for (const name of readdirSync(dir).sort()) {
    if (SKIPPED.has(name)) {
      continue
    }
    const path = join(dir, name)
    if (isDir(path)) {
      walk(path, out, keep)
    } else if (keep(path)) {
      out.push(path)
    }
  }
  return out
}

// Every package's manifest under `root`, by the package's name.
function packages(root) {
  const found = new Map()
  for (const top of ['apps', 'packages']) {
    if (isDir(join(root, top))) {
      for (const file of walk(join(root, top), [], (p) => p.endsWith('/package.json'))) {
        found.set(JSON.parse(readFileSync(file, 'utf8')).name, dirname(file))
      }
    }
  }
  return found
}

rmSync(into, { recursive: true, force: true })
mkdirSync(into, { recursive: true })
const top = readdirSync(repo).filter((n) => !isDir(join(repo, n)) && !n.startsWith('.'))
const files = [
  ...top.map((n) => join(repo, n)),
  ...KEPT.filter((k) => isDir(join(repo, k))).flatMap((k) => walk(join(repo, k), [], (p) => !pruned(relative(repo, p)))),
]
for (const file of files) {
  const to = join(into, relative(repo, file))
  mkdirSync(dirname(to), { recursive: true })
  copyFileSync(file, to)
}
for (const [rel, lines] of Object.entries(EMPTIED)) {
  if (isDir(join(repo, dirname(rel)))) {
    mkdirSync(join(into, dirname(rel)), { recursive: true })
    writeFileSync(join(into, rel), lines.join('\n'))
  }
}

const before = packages(repo)
const after = packages(into)
const gone = new Set([...before.keys()].filter((n) => !after.has(n)))

const errors = []
for (const [name, dir] of after) {
  const file = join(dir, 'package.json')
  const manifest = JSON.parse(readFileSync(file, 'utf8'))
  for (const field of ['dependencies', 'devDependencies', 'peerDependencies']) {
    for (const dep of Object.keys(manifest[field] ?? {})) {
      if (gone.has(dep)) {
        delete manifest[field][dep]
      }
    }
  }
  writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`)
  for (const source of walk(dir, [], (p) => SOURCE.test(p))) {
    const text = readFileSync(source, 'utf8')
    for (const m of text.matchAll(/(?:\bfrom|\bimport)\s*\(?\s*['"](@[\w.-]+\/[\w.-]+)[^'"]*['"]/g)) {
      if (gone.has(m[1])) {
        errors.push(`${relative(into, source)} imports ${m[1]}, a slice above core: ${name} must stand without it`)
      }
    }
  }
}

if (errors.length) {
  for (const e of [...new Set(errors)]) {
    console.error(e)
  }
  console.error(`${errors.length} import(s) of a pruned slice; core and the shell stand without every slice above core`)
  process.exit(1)
}
console.log(`pruned ${gone.size} packages, kept ${after.size}`)
