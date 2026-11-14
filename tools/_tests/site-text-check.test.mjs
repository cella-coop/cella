// The site's text check (apps/site/index.md, whose words): a commit since
// main that changes apps/site/src/content/ and is not the operator's is
// refused by name, its commit, its author and its files; the operator's
// commits to the text, and anyone's elsewhere, pass. Each case is a
// repository of its own, its main the base.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { OPERATOR } from '../site-text-check.mjs'

const tool = new URL('../site-text-check.mjs', import.meta.url).pathname
const lane = 'build-lane <build-lane@corpus.pub>'
const operator = `The Operator <${OPERATOR}>`

/** A repository on main with one commit, and a change branched from it. */
function repo() {
  const root = mkdtempSync(join(tmpdir(), 'site-text-'))
  const git = (...args) => {
    const out = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' })
    assert.equal(out.status, 0, out.stderr)
    return out.stdout.trim()
  }
  git('init', '-q', '-b', 'main')
  git('config', 'user.name', 'build-lane')
  git('config', 'user.email', 'build-lane@corpus.pub')
  const commit = (author, files) => {
    for (const [path, body] of Object.entries(files)) {
      mkdirSync(dirname(join(root, path)), { recursive: true })
      writeFileSync(join(root, path), body)
    }
    git('add', '-A')
    git('commit', '-q', '--author', author, '-m', `write ${Object.keys(files).join(', ')}`)
    return git('rev-parse', 'HEAD')
  }
  commit(operator, { 'apps/site/src/content/site.toml': 'title = "Cella"\n' })
  git('checkout', '-q', '-b', 'change')
  const check = () => spawnSync('node', [tool, root], { encoding: 'utf8' })
  return { git, commit, check }
}

test("a commit to the text by another author is refused, naming the commit, its author and the files", () => {
  const { commit, check } = repo()
  commit(lane, { 'apps/site/src/components/Hero.astro': '<h1/>\n' })
  const sha = commit(lane, { 'apps/site/src/content/site.toml': 'title = "Celia"\n' })
  const out = check()
  assert.equal(out.status, 1)
  assert.match(out.stderr, new RegExp(`${sha.slice(0, 12)} by ${lane}`))
  assert.match(out.stderr, /apps\/site\/src\/content\/site\.toml/)
  assert.doesNotMatch(out.stderr, /Hero\.astro/)
  assert.match(out.stderr, /1 commit since main/)
})

test("a commit by the operator's identity passes, under any name", () => {
  const { commit, check } = repo()
  commit(`ixxie <${OPERATOR}>`, { 'apps/site/src/content/sections/what.mdx': 'What it is.\n' })
  const out = check()
  assert.equal(out.status, 0, out.stderr)
  assert.match(out.stdout, /every commit since main that changes it is the operator's/)
})

test("the operator's name with another email is not the operator", () => {
  const { commit, check } = repo()
  commit('The Operator <plan-lane@corpus.pub>', { 'apps/site/src/content/site.toml': 'x\n' })
  assert.equal(check().status, 1)
})

test('a removal of a file of the text by another author is refused', () => {
  const { git, check } = repo()
  git('rm', '-q', 'apps/site/src/content/site.toml')
  git('commit', '-q', '-m', 'remove the text')
  const out = check()
  assert.equal(out.status, 1)
  assert.match(out.stderr, /site\.toml/)
})

test("another author's commits elsewhere, and the text's commits already on main, pass", () => {
  const { git, commit, check } = repo()
  commit(lane, { 'apps/site/src/drafts/site.toml': 'title = "Draft"\n', 'apps/site/src/content.config.ts': '//\n' })
  assert.equal(check().status, 0)
  // On main itself there is nothing since main.
  git('checkout', '-q', 'main')
  assert.equal(check().status, 0)
})

test("the forge's main is the base where the checkout has it", () => {
  const { git, commit, check } = repo()
  commit(lane, { 'apps/site/src/content/site.toml': 'y\n' })
  // The forge's main already holds the lane's commit: it is not this change's.
  git('update-ref', 'refs/remotes/origin/main', 'HEAD')
  assert.equal(check().status, 0)
})

/** The operator's commit to the text on a branch of its own, `text`, off
 * main, and a lane's commit elsewhere on the change, for a merge to join. */
function diverged() {
  const r = repo()
  r.git('checkout', '-q', '-b', 'text', 'main')
  const theirs = r.commit(operator, { 'apps/site/src/content/site.toml': 'title = "Cella, the workspace"\n' })
  r.git('checkout', '-q', 'change')
  r.commit(lane, { 'apps/site/src/components/Hero.astro': '<h1/>\n' })
  return { ...r, theirs }
}

test("another author's merge whose resolution changes the text is refused, by the merge", () => {
  const { git, check } = diverged()
  git('merge', '-q', '--no-ff', '--no-commit', 'text')
  writeFileSync(join(git('rev-parse', '--show-toplevel'), 'apps/site/src/content/site.toml'), 'title = "Celia"\n')
  git('add', '-A')
  git('commit', '-q', '--author', lane, '-m', 'merge the text')
  const merge = git('rev-parse', 'HEAD')
  const out = check()
  assert.equal(out.status, 1)
  assert.match(out.stderr, new RegExp(`${merge.slice(0, 12)} by ${lane}`))
  assert.match(out.stderr, /apps\/site\/src\/content\/site\.toml/)
  assert.match(out.stderr, /1 commit since main/)
})

test("another author's merge that only brings the operator's commits to the text in passes", () => {
  const { git, check } = diverged()
  git('merge', '-q', '--no-ff', '-m', 'merge the text', 'text')
  const out = check()
  assert.equal(out.status, 0, out.stderr)
  assert.match(out.stdout, /every commit since main that changes it is the operator's/)
})
