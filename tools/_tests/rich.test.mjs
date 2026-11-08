// The fixture check's richness rule, on Lanterne and on Lanterne thinned:
// a collection with too few rows, a lane of its board no row holds, a
// relation no row has, a circle that owns none of a collection its work
// fills, and a collection a slice mounts that the check lists nothing of
// each fail, naming the collection or the circle and what it lacks.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parse } from 'smol-toml'
import { mounted, rich } from '../fixture/rich.mjs'

const repo = new URL('../..', import.meta.url).pathname
const dir = join(repo, 'apps/org/fixtures/lanterne')

// Lanterne's files, each as `thin` changes it.
function lanterne(thin = {}) {
  return (file) => {
    const path = join(dir, `${file}.toml`)
    const read = existsSync(path) ? parse(readFileSync(path, 'utf8')) : {}
    return thin[file] ? thin[file](read) : read
  }
}

const failures = (read, at = repo) => {
  const out = []
  rich(read, (m) => out.push(m), at)
  return out
}

test('Lanterne shows every feature, and every circle a slice of its own', () => {
  assert.deepEqual(failures(lanterne()), [])
})

test('a circle that owns no row of a collection its work fills fails, by name', () => {
  const read = lanterne({ document: (d) => ({ ...d, document: d.document.filter((x) => x.circle !== 'web') }) })
  assert.deepEqual(failures(read), ['circle web: owns no row of documents, so its lens shows documents empty'])
})

test('a lane of a board no row holds fails', () => {
  const read = lanterne({ meeting: (m) => ({ ...m, meeting: m.meeting.filter((x) => x.status !== 'cancelled') }) })
  assert.deepEqual(failures(read), ['collection meetings: no row is status cancelled, so its lane shows empty'])
})

test('too few rows, and a relation no row has, fail', () => {
  const read = lanterne({
    contact: (c) => ({ ...c, contact: c.contact.slice(0, 1) }),
    'graft.membership-task': () => ({}),
  })
  assert.deepEqual(failures(read), ['collection contacts: 1 row, fewer than the 2 that show it', 'collection tasks: no row has an assignee'])
})

test('a collection a slice mounts that the check lists nothing of fails, and only top-level keys are collections', () => {
  const at = mkdtempSync(join(tmpdir(), 'cella-rich-'))
  try {
    const api = join(at, 'apps/org/feats/widget/core/ts/src/api')
    mkdirSync(api, { recursive: true })
    writeFileSync(
      join(api, 'index.ts'),
      `export const slice = {\n  name: 'widget',\n  collections: {\n    widgets: {\n      list: { sql: \`SELECT \${columns} FROM widget.widget\` },\n      actions: { make: {} },\n    },\n  },\n}\n`,
    )
    assert.deepEqual([...mounted(at).keys()], ['widgets'])
    const out = failures(lanterne(), at)
    assert.ok(out.includes('collection widgets (apps/org/feats/widget/core/ts/src/api/index.ts): the fixture check reads none of its rows; say in tools/fixture/rich.mjs what of a fixture it lists'))
    assert.ok(out.includes('collection tasks: tools/fixture/rich.mjs lists it, and no slice mounts it'))
  } finally {
    rmSync(at, { recursive: true, force: true })
  }
})
