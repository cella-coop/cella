// The pruned tree: every slice above core left out of a copy of the app,
// the shell's composition root above core emptied and the manifests'
// dependencies on what was left out dropped; a core package or the shell
// that still imports a slice above core fails it, naming the file and the
// slice.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

const pruner = new URL('../prune.mjs', import.meta.url).pathname

// What each test reads of the copy.
const READ = [
  'apps/org/feats/motion/feat.toml',
  'apps/org/grafts/meeting-motion/ts/package.json',
  'apps/org/ts/_e2e/motion.test.ts',
  'apps/org/ts/src/lib/feats/index.ts',
  'apps/org/ts/src/lib/server/feats/index.ts',
  'apps/org/ts/package.json',
  'apps/org/core/circle/ts/src/index.ts',
]

// A throwaway app: core's circle, a feat motion and a graft of it, and
// the shell, whose composition root above core names the feat; `files`
// writes each file by its path over them.
function pruned(files = {}) {
  const repo = mkdtempSync(join(tmpdir(), 'cella-prune-'))
  const into = mkdtempSync(join(tmpdir(), 'cella-pruned-'))
  const write = (path, text) => {
    mkdirSync(dirname(join(repo, path)), { recursive: true })
    writeFileSync(join(repo, path), text)
  }
  const pkg = (dir, name, deps = []) =>
    write(join(dir, 'package.json'), JSON.stringify({ name, dependencies: Object.fromEntries(deps.map((d) => [d, 'workspace:*'])) }))
  write('package.json', '{}')
  write('apps/org/feat.toml', 'name = "org"\n')
  pkg('apps/org/core/circle/ts', '@t/circle')
  write('apps/org/core/circle/ts/src/index.ts', 'export const circle = 1\n')
  write('apps/org/feats/motion/feat.toml', 'name = "motion"\ngrafts = []\n')
  pkg('apps/org/feats/motion/core/ts', '@t/motion', ['@t/circle'])
  write('apps/org/feats/motion/core/ts/src/index.ts', "import { circle } from '@t/circle'\nexport const motion = circle\n")
  pkg('apps/org/grafts/meeting-motion/ts', '@t/graft-meeting-motion', ['@t/motion'])
  pkg('apps/org/ts', '@t/org', ['@t/circle', '@t/motion', '@t/graft-meeting-motion'])
  write('apps/org/ts/src/lib/slices.ts', "import { circle } from '@t/circle'\nimport { feats } from './feats/index.ts'\nexport const apps = [circle, ...feats]\n")
  write('apps/org/ts/src/lib/feats/index.ts', "import { motion } from '@t/motion'\nexport const feats = [motion]\n")
  write('apps/org/ts/src/lib/server/feats/index.ts', "import { motion } from '@t/motion'\nexport const feats = [motion]\n")
  write('apps/org/ts/_e2e/motion.test.ts', "import { motion } from '@t/motion'\n")
  for (const [path, text] of Object.entries(files)) {
    write(path, text)
  }
  try {
    const run = spawnSync(process.execPath, [pruner, repo, into], { encoding: 'utf8' })
    const kept = Object.fromEntries(READ.map((p) => [p, existsSync(join(into, p)) ? readFileSync(join(into, p), 'utf8') : null]))
    return { code: run.status, errors: run.stderr, read: (path) => kept[path] }
  } finally {
    rmSync(repo, { recursive: true, force: true })
    rmSync(into, { recursive: true, force: true })
  }
}

test('core and the shell stand without the slices above core, which the copy leaves out', () => {
  const { code, errors, read } = pruned()
  assert.equal(errors, '')
  assert.equal(code, 0)
  assert.equal(read('apps/org/feats/motion/feat.toml'), null)
  assert.equal(read('apps/org/grafts/meeting-motion/ts/package.json'), null)
  assert.equal(read('apps/org/ts/_e2e/motion.test.ts'), null)
  assert.match(read('apps/org/ts/src/lib/feats/index.ts'), /export const feats: App\[\] = \[\]/)
  assert.match(read('apps/org/ts/src/lib/server/feats/index.ts'), /export const feats: Slice\[\] = \[\]/)
  assert.deepEqual(JSON.parse(read('apps/org/ts/package.json')).dependencies, { '@t/circle': 'workspace:*' })
  assert.ok(read('apps/org/core/circle/ts/src/index.ts'))
})

test('a core package importing a feat fails the pruned build', () => {
  const { code, errors } = pruned({ 'apps/org/core/circle/ts/src/index.ts': "export { motion } from '@t/motion/api'\n" })
  assert.equal(code, 1)
  assert.match(errors, /apps\/org\/core\/circle\/ts\/src\/index\.ts imports @t\/motion, a slice above core: @t\/circle must stand without it/)
})

test('the shell importing a feat outside its composition root fails the pruned build', () => {
  const { code, errors } = pruned({ 'apps/org/ts/src/routes/join/+page.server.ts': "import { accept } from '@t/motion'\n" })
  assert.equal(code, 1)
  assert.match(errors, /apps\/org\/ts\/src\/routes\/join\/\+page\.server\.ts imports @t\/motion, a slice above core: @t\/org must stand without it/)
})
