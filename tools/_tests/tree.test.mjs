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

// A throwaway tree: org with decision and person, person with membership
// and employment; each package named by its slice, depending on `deps`.
// `grafts` places each graft by the node it sits at and names what it
// declares and depends on; `extra` adds feats.
function tree({ grafts = {}, deps = {}, extra = [] }) {
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
  feat('apps/org/feats/decision', 'decision', declared('decision'))
  feat('apps/org/feats/person', 'person', declared('person'))
  feat('apps/org/feats/person/feats/membership', 'membership', declared('membership'))
  feat('apps/org/feats/person/feats/employment', 'employment', declared('employment'))
  for (const [node, name] of extra) {
    feat(node, name, declared(name))
  }
  for (const [g, x] of Object.entries(grafts)) {
    pkg(join(x.at, 'grafts', g, 'ts'), g, x.deps)
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
      'decision-membership': { at: org, by: 'membership', deps: ['decision', 'membership', 'person'] },
      'employment-membership': { at: person, by: 'employment', deps: ['employment', 'membership', 'person'] },
      'decision-employment-membership': { at: org, by: 'employment', deps: ['decision', 'employment-membership', 'person'] },
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
      'decision-membership': { at: org, by: 'membership' },
      'employment-membership': { at: person, by: 'employment', deps: ['decision', 'decision-membership'] },
    },
  })
  assert.match(errors, /graft employment-membership .* may not depend on core apps\/org\/feats\/decision/)
  assert.match(errors, /graft employment-membership .* may not depend on graft decision-membership/)
})

test('a feat\'s name is unique in its app, at any depth', () => {
  const errors = tree({ extra: [['apps/org/feats/decision/feats/membership', 'membership']] })
  assert.match(errors, /a feat's name is unique in its app/)
})
