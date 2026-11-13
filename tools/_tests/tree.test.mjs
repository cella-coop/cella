// The feat check's tree with a nested feat: a child's core builds on its
// parent's and never the other way; a graft sits at the lowest node that
// holds every feat it joins, reads the cores those feats nest in and the
// lower grafts at or below its node, and never joins a feat with one
// nested in it; a graft is named in order and declared by a feat it
// joins; a feat's name is unique in its app and has no hyphen. In a
// node's core, no core feat builds on another, nor a core library on one:
// a core graft joins them. A package's relative imports stay inside it and
// point inward through its layers, and it exports only its surface, each
// export's target in its layer; nothing re-exports another package of the
// tree, and only a shell imports a slice's app.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const checker = new URL('../feat-check.mjs', import.meta.url).pathname

// A throwaway tree: org with motion and party, party with membership
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
  feat('apps/org/feats/party', 'party', declared('party'))
  feat('apps/org/feats/party/feats/membership', 'membership', declared('membership'))
  feat('apps/org/feats/party/feats/employment', 'employment', declared('employment'))
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
const party = 'apps/org/feats/party'

test('a child builds on its parent, and a graft at the lowest node reads the cores its feats nest in and the lower grafts below it', () => {
  const errors = tree({
    deps: { membership: ['party'], employment: ['party'] },
    grafts: {
      'membership-motion': { at: org, by: 'membership', deps: ['motion', 'membership', 'party'] },
      'employment-membership': { at: party, by: 'employment', deps: ['employment', 'membership', 'party'] },
      'employment-membership-motion': { at: org, by: 'employment', deps: ['motion', 'employment-membership', 'party'] },
    },
  })
  assert.equal(errors, '')
})

test('a parent never builds on its child', () => {
  const errors = tree({ deps: { party: ['membership'] } })
  assert.match(errors, /core apps\/org\/feats\/party .* may not depend on core apps\/org\/feats\/party\/feats\/membership/)
})

test('a graft sits at the lowest node that holds every feat it joins', () => {
  const errors = tree({ grafts: { 'employment-membership': { at: org, by: 'employment' } } })
  assert.match(errors, /apps\/org\/grafts\/employment-membership: every feat it joins is below apps\/org\/feats\/party; a graft sits at the lowest node that holds them all/)
})

test('a graft never joins a feat with one nested in it', () => {
  const errors = tree({ grafts: { 'membership-party': { at: org, by: 'membership' } } })
  assert.match(errors, /joins party and membership, nested in it; a child inherits its parent's core/)
})

test('a graft never joins a core feat, which every feat reads already', () => {
  const errors = tree({
    grafts: { 'motion-person': { at: org, by: 'motion' } },
    files: { 'apps/org/core/person/ts/package.json': JSON.stringify({ name: '@t/person' }), 'apps/org/core/person/sql/001.sql': '' },
  })
  assert.match(errors, /apps\/org\/grafts\/motion-person: joins person, a core feat, which every feat and graft reads already; no graft joins core/)
  assert.doesNotMatch(errors, /joins person, which is not a feat below/)
})

test('a graft reads no core of a feat it does not join, nor a graft above its node', () => {
  const errors = tree({
    grafts: {
      'membership-motion': { at: org, by: 'membership' },
      'employment-membership': { at: party, by: 'employment', deps: ['motion', 'membership-motion'] },
    },
  })
  assert.match(errors, /graft employment-membership .* may not depend on core apps\/org\/feats\/motion/)
  assert.match(errors, /graft employment-membership .* may not depend on graft membership-motion/)
})

// Org's core: the library `db`, the core feats `circle`, `policy` and
// `ledger`, each with SQL of its own, and the notary, with SQL and no
// feat; each package depending on those `deps` names, and core's graft
// joining the circles to the register on `graft`'s.
function core(deps = {}, graft = ['circle', 'policy', 'db']) {
  const pkg = (dir, name) => ({ [`${dir}/package.json`]: JSON.stringify({ name: `@t/${name}`, dependencies: Object.fromEntries((deps[name] ?? []).map((d) => [`@t/${d}`, 'workspace:*'])) }) })
  const files = { ...pkg('apps/org/core/db/ts', 'db'), ...pkg('apps/org/core/notary/ts', 'notary'), 'apps/org/core/notary/sql/001.sql': '' }
  for (const f of ['circle', 'policy', 'ledger']) {
    Object.assign(files, pkg(`apps/org/core/${f}/ts`, f), { [`apps/org/core/${f}/sql/001.sql`]: '' })
  }
  deps['circle-policy'] = graft
  Object.assign(files, pkg('apps/org/core/grafts/circle-policy/ts', 'circle-policy'))
  return tree({ files })
}

test('a core feat builds on its core\'s libraries and the notary, and a core graft on the core feats it joins', () => {
  assert.equal(core({ circle: ['db', 'notary'], policy: ['db'], db: ['notary'] }), '')
})

test('a core feat never builds on another core feat, its package depending on it', () => {
  const errors = core({ circle: ['policy'] })
  assert.match(errors, /apps\/org\/core\/circle\/ts: depends on apps\/org\/core\/policy\/ts, the core feat policy; no core feat nor core library builds on another core feat: a core graft joins them/)
})

test('a core library builds on no core feat, so none routes one core feat to another', () => {
  const errors = core({ circle: ['db'], db: ['policy'] })
  assert.match(errors, /apps\/org\/core\/db\/ts: depends on apps\/org\/core\/policy\/ts, the core feat policy; no core feat nor core library builds on another core feat/)
})

test('a core graft builds on no core feat it does not join', () => {
  const errors = core({}, ['circle', 'policy', 'ledger'])
  assert.match(errors, /apps\/org\/core\/grafts\/circle-policy\/ts: depends on apps\/org\/core\/ledger\/ts, the core feat ledger; core graft circle-policy joins no ledger/)
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
    deps: { party: ['site'] },
    files: { 'packages/brand/package.json': brand, 'apps/site/package.json': site({ '@t/motion': 'workspace:*' }) },
  })
  assert.match(errors, /apps\/site: depends on apps\/org\/feats\/motion\/core\/ts; the site depends on no package of the repository but one outside the tree/)
  assert.match(errors, /apps\/org\/feats\/party\/core\/ts: depends on apps\/site; no package depends on the site/)
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
  const errors = tree({ files: { [`${src}/models/actions.ts`]: declaring.replace('motion:motion', 'party:motion') } })
  assert.match(errors, /party:motion:propose is not an action of motion/)
})

test('a package\'s relative imports stay inside it', () => {
  const ok = tree({ files: { [`${src}/handlers/propose.ts`]: "import { actions } from '../models/actions.ts'\n" } })
  assert.doesNotMatch(ok, /outside its package/)
  const errors = tree({ files: { [`${src}/handlers/propose.ts`]: "import { party } from '../../../../../party/core/ts/src/index.ts'\n" } })
  assert.match(errors, /handlers\/propose\.ts: imports \.\.\/\.\.\/\.\.\/\.\.\/\.\.\/party\/core\/ts\/src\/index\.ts, outside its package apps\/org\/feats\/motion\/core\/ts; depend on the package instead/)
})

test('a package\'s layers import only the layers inside them', () => {
  const ok = tree({
    files: {
      [`${src}/drivers/motions.ts`]: "import { actions } from '../models/actions.ts'\nimport type { Motions } from '../interfaces/motions.ts'\n",
      [`${src}/components/Motion.svelte`]: "<script lang=\"ts\">\n  import { useMotion } from '../hooks/useMotion.ts'\n</script>\n",
      [`${src}/index.ts`]: "export * from './app/index.ts'\n",
    },
  })
  assert.doesNotMatch(ok, /a layer outside its own/)
  const errors = tree({
    files: {
      [`${src}/models/motion.ts`]: "import { propose } from '../handlers/propose.ts'\n",
      [`${src}/handlers/propose.ts`]: "import { motions } from '../drivers/motions.ts'\n",
      [`${src}/hooks/useMotion.ts`]: "const pane = await import('../components/Motion.svelte')\n",
    },
  })
  assert.match(errors, /models\/motion\.ts: imports \.\.\/handlers\/propose\.ts, in handlers, a layer outside its own models; imports point inward/)
  assert.match(errors, /handlers\/propose\.ts: imports \.\.\/drivers\/motions\.ts, in drivers, a layer outside its own handlers/)
  assert.match(errors, /hooks\/useMotion\.ts: imports \.\.\/components\/Motion\.svelte, in components, a layer outside its own hooks/)
})

test('a package exports only its surface', () => {
  const pkg = (exports) => ({ 'apps/org/feats/motion/core/ts/package.json': JSON.stringify({ name: '@t/motion', exports }) })
  assert.equal(tree({ files: pkg({ './models': './src/models/index.ts', './api': './src/api/index.ts', './bindings': './src/bindings/index.ts', './app': './src/app/index.ts' }) }), '')
  const errors = tree({ files: pkg({ './models': './src/models/index.ts', './internal': './src/internal.ts' }) })
  assert.match(errors, /apps\/org\/feats\/motion\/core\/ts\/package\.json: exports \.\/internal; a package exports only \., \.\/models, \.\/api, \.\/bindings, \.\/app/)
})

test('a graft is named by the feats it joins, in alphabetical order', () => {
  const errors = tree({ grafts: { 'motion-membership': { at: org, by: 'membership' } } })
  assert.match(errors, /apps\/org\/grafts\/motion-membership: a graft is named by two or more distinct feats, in alphabetical order/)
})

test('a graft is declared by a feat it joins, and a feat declares only the grafts that join it', () => {
  const errors = tree({ grafts: { 'membership-motion': { at: org } } })
  assert.match(errors, /apps\/org\/grafts\/membership-motion: no feat it joins declares it in its feat\.toml/)
  const stray = tree({ grafts: { 'membership-motion': { at: org, by: 'party' } } })
  assert.match(stray, /apps\/org\/feats\/party: declares membership-motion, which does not join it; the feat that extends declares a graft/)
})

test('a feat\'s name has no hyphen', () => {
  const errors = tree({ extra: [['apps/org/feats/motion-plan', 'motion-plan']] })
  assert.match(errors, /apps\/org\/feats\/motion-plan: a feat's name has no hyphen; hyphens join feats in a graft's name/)
})

const membership = 'apps/org/feats/party/feats/membership/core/ts'
const manifest = (name, deps = {}, more = {}) => JSON.stringify({ name: `@t/${name}`, dependencies: Object.fromEntries(Object.entries(deps).map(([k, v]) => [k, v])), ...more })

test('an export\'s target sits in the layer its key names', () => {
  const pkg = (exports) => ({ 'apps/org/feats/motion/core/ts/package.json': JSON.stringify({ name: '@t/motion', exports }) })
  const errors = tree({ files: pkg({ './models': './src/models/index.ts', './api': './src/app/index.ts', './bindings': '../../../party/core/ts/src/app/index.ts' }) })
  assert.match(errors, /motion\/core\/ts\/package\.json: exports \.\/api as \.\/src\/app\/index\.ts, outside src\/api\/; an export's target sits in the layer its key names/)
  assert.match(errors, /exports \.\/bindings as \.\.\/\.\.\/\.\.\/party\/core\/ts\/src\/app\/index\.ts, outside src\/bindings\//)
  assert.doesNotMatch(errors, /exports \.\/models as/)
})

test('nothing re-exports another package of the tree, by export from or by exporting a name it imported', () => {
  const ok = tree({
    deps: { membership: ['party'] },
    files: {
      [`${membership}/src/models/index.ts`]: "export * from './member.ts'\nexport { brand } from '@t/brand'\n",
      [`${membership}/src/models/member.ts`]: "import type { Party } from '@t/party/models'\nexport type Member = { party: Party }\n",
      'packages/brand/package.json': JSON.stringify({ name: '@t/brand', exports: { '.': './src/index.ts' } }),
    },
  })
  assert.equal(ok, '')
  const errors = tree({
    deps: { membership: ['party'] },
    files: {
      [`${membership}/src/models/index.ts`]: "export * from '@t/party/models'\nexport type { Party as P } from '@t/party/models'\n",
      [`${membership}/src/api/index.ts`]: "import { party, type Party } from '@t/party/api'\nexport { party }\nexport type { Party }\n",
    },
  })
  assert.match(errors, /membership\/core\/ts\/src\/models\/index\.ts: re-exports @t\/party\/models, of @t\/party; nothing re-exports another package of the tree/)
  assert.match(errors, /membership\/core\/ts\/src\/api\/index\.ts: re-exports party, imported from @t\/party\/api/)
  assert.match(errors, /membership\/core\/ts\/src\/api\/index\.ts: re-exports Party, imported from @t\/party\/api/)
})

test('a re-export through an aliased dependency is refused as any', () => {
  const errors = tree({
    files: {
      [`${membership}/package.json`]: manifest('membership', { p: 'workspace:@t/party@*' }),
      [`${membership}/src/models/index.ts`]: "export { party } from 'p/models'\n",
    },
  })
  assert.match(errors, /src\/models\/index\.ts: re-exports p\/models, of @t\/party/)
  assert.doesNotMatch(errors, /not in the workspace/)
})

test('only a shell imports a slice\'s app; another slice uses its contract, and a library\'s app is open', () => {
  const ok = tree({
    deps: { membership: ['party', 'body'] },
    files: {
      'apps/org/ts/package.json': manifest('org', { '@t/motion': 'workspace:*', '@t/membership-motion': 'workspace:*' }),
      'apps/org/ts/src/slices.ts': "import { app } from '@t/motion/app'\nimport { app as joined } from '@t/membership-motion/app'\n",
      'apps/org/core/body/ts/package.json': manifest('body', {}, { exports: { './app': './src/app/index.ts' } }),
      [`${membership}/src/app/blocks/Member.svelte`]: "<script lang=\"ts\">\n  import { Reader } from '@t/body/app'\n  import { Card } from '@t/party/bindings'\n</script>\n",
    },
    grafts: { 'membership-motion': { at: org, by: 'membership', deps: ['motion', 'membership', 'party'] } },
  })
  assert.equal(ok, '')
  const errors = tree({
    deps: { membership: ['party'] },
    grafts: { 'membership-motion': { at: org, by: 'membership', deps: ['motion', 'membership', 'party'] } },
    files: {
      [`${membership}/src/app/blocks/Member.svelte`]: "<script lang=\"ts\">\n  import { Card } from '@t/party/app'\n</script>\n",
      'apps/org/grafts/membership-motion/ts/package.json': manifest('membership-motion', { '@t/motion': 'workspace:*' }, { imports: { '#motion': '@t/motion/app' } }),
      'apps/org/grafts/membership-motion/ts/src/app/index.ts': "import { Card } from '#motion'\n",
    },
  })
  assert.match(errors, /membership\/core\/ts\/src\/app\/blocks\/Member\.svelte: imports @t\/party\/app, the app of @t\/party; only a shell imports a slice's app/)
  assert.match(errors, /membership-motion\/ts\/src\/app\/index\.ts: imports #motion, the app of @t\/motion; only a shell imports a slice's app/)
})

test('a package\'s imports stay inside it', () => {
  const errors = tree({ files: { [`${membership}/package.json`]: manifest('membership', {}, { imports: { '#party/*': '../../../../core/ts/src/*' } }) } })
  assert.match(errors, /membership\/core\/ts\/package\.json: imports #party\/\* as \.\.\/\.\.\/\.\.\/\.\.\/core\/ts\/src\/\*, outside its package/)
})
