// The spelling check (tools/spelling.mjs): a tracked text file that spells
// coop with a hyphen is refused by its file and line and the word to write,
// in any case and form; a web address, a proper name it lists, the word
// "co-operative", the site's text, the dated Records, a lockfile, a binary
// and an untracked file are not. Each case is a repository of its own. The
// refused word is spelled in two parts, so this file holds none of it.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { NAMES, read, refused } from '../spelling.mjs'

const tool = new URL('../spelling.mjs', import.meta.url).pathname
const hyphen = 'co' + '-op'

/** The check over a repository whose tracked files are `files`, and
 * `loose` untracked, with `args` before its root. */
function repo(files, loose = {}, args = []) {
  const root = mkdtempSync(join(tmpdir(), 'spelling-'))
  const write = (all) => {
    for (const [path, body] of Object.entries(all)) {
      mkdirSync(dirname(join(root, path)), { recursive: true })
      writeFileSync(join(root, path), body)
    }
  }
  spawnSync('git', ['-C', root, 'init', '-q', '-b', 'main'])
  write(files)
  spawnSync('git', ['-C', root, 'add', '-A'])
  write(loose)
  return spawnSync('node', [tool, ...args, root], { encoding: 'utf8' })
}

test('each hyphenated form is refused by its file, its line and the word to write', () => {
  const out = repo({
    'apps/org/feats/x/sql/001-x.sql': `-- one\nRAISE '%', 'the ${hyphen}''s books are closed';\n`,
    'apps/org/core/ui/ts/src/components/X.svelte': `<p>${hyphen[0].toUpperCase()}${hyphen.slice(1)}s</p>\n`,
    '_corpus/doc/trust.md': `A ${hyphen.toUpperCase()} and a ${hyphen}-specific layer.\n`,
  })
  const said = (at, word) => `${at}: "${word}" is spelled "${word.replace('-', '')}"`
  assert.equal(out.status, 1)
  assert.ok(out.stderr.includes(said('apps/org/feats/x/sql/001-x.sql:2', hyphen)), out.stderr)
  assert.ok(out.stderr.includes(said('apps/org/core/ui/ts/src/components/X.svelte:1', 'Co' + '-ops')), out.stderr)
  assert.ok(out.stderr.includes(said('_corpus/doc/trust.md:1', hyphen.toUpperCase())), out.stderr)
  assert.ok(out.stderr.includes(said('_corpus/doc/trust.md:1', hyphen)), out.stderr)
  assert.match(out.stderr, /4 words in 3 files/)
})

test('coop, co-operative, a web address and a listed proper name pass', () => {
  const out = repo({
    'README.md': [
      'A coop, its coops and the coop\'s books.',
      'Lanterne, a worker co-operative; Co-operatives UK.',
      `[the news](https://www.thenews.coop/mondragon-worker-${hyphen}-federation/)`,
      `Banked with the ${NAMES[1]}.`,
      '',
    ].join('\n'),
  })
  assert.equal(out.status, 0, out.stderr)
  assert.match(out.stdout, /every tracked text file of the org writes coop/)
})

test("the site's text, the dated Records, lockfiles, binaries and untracked files are not read", () => {
  const word = `a ${hyphen}\n`
  const out = repo(
    {
      'apps/site/src/content/site.toml': word,
      '_corpus/change/26-10-25-a.md': word,
      '_corpus/review/2026-10-25/index.md': word,
      '_corpus/turn/26-10-25-a-1953.md': word,
      '_corpus/doc/26-11-09-graft-architecture-review.md': word,
      'pnpm-lock.yaml': word,
      'apps/org/fixtures/lanterne/files/a.pdf': Buffer.concat([Buffer.from([0x25, 0x50, 0x44, 0x46, 0]), Buffer.from(word)]),
    },
    { 'apps/org/index.md': word },
  )
  assert.equal(out.status, 0, out.stderr)
})

test("the site and the diagrams are the site's half, read with --site alone", () => {
  const word = `a ${hyphen}\n`
  const files = { 'apps/site/src/components/Hero.astro': word, 'packages/diagrams/src/a.svelte': word, 'apps/site/src/content/site.toml': word }
  assert.equal(repo(files).status, 0)
  const out = repo(files, {}, ['--site'])
  assert.equal(out.status, 1)
  assert.match(out.stderr, /Hero\.astro:1/)
  assert.match(out.stderr, /packages\/diagrams\/src\/a\.svelte:1/)
  assert.doesNotMatch(out.stderr, /content/)
})

test('a living doc under _corpus and a site file outside its text are read', () => {
  assert.equal(read('_corpus/doc/architecture.md'), true)
  assert.equal(read('_corpus/doc/users/01-small-private.md'), true)
  assert.equal(read('apps/site/src/drafts/site.toml'), false)
  assert.equal(read('apps/site/src/drafts/site.toml', true), true)
  assert.equal(read('apps/site/src/content/site.toml', true), false)
  assert.equal(read('tools/spelling.mjs', true), false)
  assert.equal(read('_corpus/doc/26-11-09-graft-architecture-review.md'), false)
  assert.deepEqual(refused(`x\nthe ${hyphen}s' days\n`), [{ line: 2, word: `${hyphen}s` }])
})
