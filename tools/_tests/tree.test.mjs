// The feat check's tree with a nested feat: a child's core builds on its
// parent's and never the other way; a graft sits at the lowest node that
// holds every feat it joins, reads the cores those feats nest in and the
// lower grafts at or below its node, and never joins a feat with one
// nested in it; a feat's name is unique in its app.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const checker = new URL('../feat-check.mjs', import.meta.url).pathname

// A throwaway tree: org with motion and person, person with membership
// and employment; each package named by its slice, depending on `deps`.
// `grafts` places each graft by the node it sits at and names what it
// declares and depends on; `extra` adds feats; `files` writes each file by
// its path.
function tree({ grafts = {}, deps = {}, extra = [], files = {} }) {
  const repo = mkdtempSync(join(tmpdir(), 'cella-tree-'))
  const pkg = (dir, name, needs = []) => {
    mkdirSync(join(repo, dir), { recursive: true })
    const dependencies = Object.fromEntries(needs.map((d) => [`@t/${d}`, 'workspace:*']))
    writeFileSync(join(repo, dir, 'package.json'), JSON.stringify({ name: `@t/${name}`, dependencies }))
  }
  const feat = (node, name, declares = []) => {
    mkdirSync(join(repo, node), { recursive: true })
    writeFileSync(join(repo, node, 'feat.toml'), `name = "${name}"\ngrafts = [${declares.map((g) => `"${g}"`).join(', ')}]\n`)
    pkg(join(node, 'core/ts'), name, deps[name])
  }
  const declared = (f) => Object.entries(grafts).filter(([g, x]) => x.by === f).map(([g]) => g)
  mkdirSync(join(repo, 'apps/org'), { recursive: true })
  writeFileSync(join(repo, 'apps/org/feat.toml'), 'name = "org"\n')
  feat('apps/org/feats/motion', 'motion', declared('motion'))
  feat('apps/org/feats/person', 'person', declared('person'))
  feat('apps/org/feats/person/feats/membership', 'membership', declared('membership'))
  feat('apps/org/feats/person/feats/employment', 'employment', declared('employment'))
  for (const [node, name] of extra) {
    feat(node, name, declared(name))
  }
  for (const [g, x] of Object.entries(grafts)) {
    pkg(join(x.at, 'grafts', g, 'ts'), g, x.deps)
  }
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(join(repo, path, '..'), { recursive: true })
    writeFileSync(join(repo, path), text)
  }
  try {
    const run = spawnSync(process.execPath, [checker, repo, '--no-sql'], { encoding: 'utf8' })
    return run.stderr
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
}

const org = 'apps/org'
const person = 'apps/org/feats/person'

test('a child builds on its parent, and a graft at the lowest node reads the cores its feats nest in and the lower grafts below it', () => {
  const errors = tree({
    deps: { membership: ['person'], employment: ['person'] },
    grafts: {
      'membership-motion': { at: org, by: 'membership', deps: ['motion', 'membership', 'person'] },
      'employment-membership': { at: person, by: 'employment', deps: ['employment', 'membership', 'person'] },
      'employment-membership-motion': { at: org, by: 'employment', deps: ['motion', 'employment-membership', 'person'] },
    },
  })
  assert.equal(errors, '')
})

test('a parent never builds on its child', () => {
  const errors = tree({ deps: { person: ['membership'] } })
  assert.match(errors, /core apps\/org\/feats\/person .* may not depend on core apps\/org\/feats\/person\/feats\/membership/)
})

test('a graft sits at the lowest node that holds every feat it joins', () => {
  const errors = tree({ grafts: { 'employment-membership': { at: org, by: 'employment' } } })
  assert.match(errors, /apps\/org\/grafts\/employment-membership: every feat it joins is below apps\/org\/feats\/person; a graft sits at the lowest node that holds them all/)
})

test('a graft never joins a feat with one nested in it', () => {
  const errors = tree({ grafts: { 'membership-person': { at: org, by: 'membership' } } })
  assert.match(errors, /joins person and membership, nested in it; a child inherits its parent's core/)
})

test('a graft reads no core of a feat it does not join, nor a graft above its node', () => {
  const errors = tree({
    grafts: {
      'membership-motion': { at: org, by: 'membership' },
      'employment-membership': { at: person, by: 'employment', deps: ['motion', 'membership-motion'] },
    },
  })
  assert.match(errors, /graft employment-membership .* may not depend on core apps\/org\/feats\/motion/)
  assert.match(errors, /graft employment-membership .* may not depend on graft membership-motion/)
})

test('any package may depend on one outside the tree, the brand, which depends on none of the tree', () => {
  const brand = (deps) => JSON.stringify({ name: '@t/brand', exports: { '.': './src/index.ts', './tokens.css': './tokens.css' }, dependencies: deps })
  const ok = tree({ deps: { motion: ['brand'] }, files: { 'packages/brand/package.json': brand({}), 'packages/brand/tokens.css': ':root {}\n' } })
  assert.equal(ok, '')
  const errors = tree({ files: { 'packages/brand/package.json': brand({ '@t/motion': 'workspace:*' }) } })
  assert.match(errors, /packages\/brand: depends on apps\/org\/feats\/motion\/core\/ts; a package outside the tree depends on no package of the repository/)
})

test('the site depends on the brand alone, and no package depends on the site', () => {
  const brand = JSON.stringify({ name: '@t/brand', exports: { '.': './src/index.ts' } })
  const site = (deps) => JSON.stringify({ name: '@t/site', dependencies: deps })
  const ok = tree({ files: { 'packages/brand/package.json': brand, 'apps/site/package.json': site({ '@t/brand': 'workspace:*' }) } })
  assert.equal(ok, '')
  const errors = tree({
    deps: { person: ['site'] },
    files: { 'packages/brand/package.json': brand, 'apps/site/package.json': site({ '@t/motion': 'workspace:*' }) },
  })
  assert.match(errors, /apps\/site: depends on apps\/org\/feats\/motion\/core\/ts; the site depends on no package of the repository but one outside the tree/)
  assert.match(errors, /apps\/org\/feats\/person\/core\/ts: depends on apps\/site; no package depends on the site/)
})

test('a feat\'s name is unique in its app, at any depth', () => {
  const errors = tree({ extra: [['apps/org/feats/motion/feats/membership', 'membership']] })
  assert.match(errors, /a feat's name is unique in its app/)
})

const src = 'apps/org/feats/motion/core/ts/src'
const declaring = "import { confluent, type Actions } from '@cella/org-actions'\n\nexport const actions = {\n  'motion:motion:propose': confluent({ power: 'propose' }),\n} satisfies Actions\n"

test('a feat declares its actions in its models/actions.ts', () => {
  const errors = tree({ files: { [`${src}/models/actions.ts`]: declaring, [`${src}/handlers/propose.ts`]: "import type { Outcome } from '@cella/org-actions'\n" } })
  assert.doesNotMatch(errors, /action/)
})

test('an action declared outside models/actions.ts is refused, as is a models/ops.ts', () => {
  const errors = tree({ files: { [`${src}/handlers/propose.ts`]: declaring, [`${src}/models/ops.ts`]: declaring } })
  assert.match(errors, /handlers\/propose\.ts: declares an action outside .*models\/actions\.ts/)
  assert.match(errors, /models\/ops\.ts: actions are declared in models\/actions\.ts/)
})

test('an action is its feat\'s own', () => {
  const errors = tree({ files: { [`${src}/models/actions.ts`]: declaring.replace('motion:motion', 'person:motion') } })
  assert.match(errors, /person:motion:propose is not an action of motion/)
})
