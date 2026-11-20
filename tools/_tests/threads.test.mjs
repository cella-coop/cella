// A feat's body and threads: `cella scaffold body|comments <feat>`
// writes them into the feat's own folder, named for it, and refuses a
// feat that has them already; and the feat check refuses a feat that
// keeps a body or threads without their commands, powers, folds, the
// guard on a save's base, the session's mount, the mention table or the
// reaction guard, each by name.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { whole } from '../powers.mjs'
import { Refused, scaffold } from '../scaffold.mjs'

const tool = join(dirname(fileURLToPath(import.meta.url)), '..', 'scaffold.mjs')
const file = 'apps/org/feats/note/core/ts/src/models/actions.ts'
const op = (o, power = 'discuss') => ({ op: o, power, amount: null, check: null, file })
const col = (key, type) => ({ key, type, path: 'apps/org/feats/note/core/sql/001-note.sql' })

// What the SQL check reads of a feat that keeps a body and threads whole,
// as the scaffold writes them, and its ops.
const kept = () => ({
  columns: [col('note.note.body', 'bytea'), col('note.comment.parent', 'int8'), col('note.comment.text', 'text')],
  tables: [{ key: 'note.note' }, { key: 'note.comment' }, { key: 'note.mention' }, { key: 'note.reaction' }],
  guards: [{ op: 'note:body:save', fn: 'note.contributed(jsonb)', owner: 'note' }, { op: 'note:body:save', fn: 'note.based(jsonb)', owner: 'note' }, { op: 'note:comment:post', owner: 'note' }, { op: 'note:comment:react', owner: 'note' }],
  folds: ['note:body:save', 'note:comment:post', 'note:comment:resolve', 'note:comment:react'].map((o) => ({ op: o, owner: 'note' })),
})
const ops = () => ['note:body:save', 'note:comment:post', 'note:comment:resolve', 'note:comment:react'].map((o) => op(o))
const feats = (mounts = true) => [{ name: 'note', file, mounts }]

test('a feat that keeps its body and threads whole passes', () => {
  assert.deepEqual(whole(feats(), ops(), kept()), [])
})

test('a body with no save, a save needing another power, one with no fold, one with no guard on its base and a body no session mounts are each refused by name', () => {
  const without = ops().filter((o) => o.op !== 'note:body:save')
  assert.deepEqual(whole(feats(), without, kept()), [`${file}: note keeps a body in note.note.body but declares no note:body:save: run cella scaffold, or declare it with its power and fold`])
  const other = ops().map((o) => (o.op === 'note:body:save' ? op(o.op, 'edit-note') : o))
  assert.deepEqual(whole(feats(), other, kept()), [`${file}: note:body:save needs edit-note, but a body in note.note.body is discussed: it needs discuss`])
  const unfolded = { ...kept(), folds: kept().folds.filter((f) => f.op !== 'note:body:save') }
  assert.deepEqual(whole(feats(), ops(), unfolded), [`${file}: note:body:save has no fold, so a body in note.note.body would not fold: register it by cella.lets_fold`])
  const unbased = { ...kept(), guards: kept().guards.filter((g) => g.fn !== 'note.based(jsonb)') }
  assert.deepEqual(whole(feats(), ops(), unbased), [
    `${file}: note keeps a body in note.note.body but no guard note.based on note:body:save: a save whose base is not the body it replaces would erase another editor's`,
  ])
  assert.deepEqual(whole(feats(false), ops(), kept()), [
    `${file}: note keeps a body in note.note.body but mounts none in core body's session: its collection names body: { circle, saved, save }`,
  ])
})

test('threads with no post, resolve or react, with no mention table, and with no guard on react are each refused by name', () => {
  for (const verb of ['post', 'resolve', 'react']) {
    const without = ops().filter((o) => o.op !== `note:comment:${verb}`)
    assert.deepEqual(whole(feats(), without, kept()), [
      `${file}: note keeps threads in note.comment but declares no note:comment:${verb}: run cella scaffold, or declare it with its power and fold`,
    ])
  }
  const unmentioned = { ...kept(), tables: kept().tables.filter((t) => t.key !== 'note.mention') }
  assert.deepEqual(whole(feats(), ops(), unmentioned), [`${file}: note keeps threads in note.comment but no note.mention: a comment's mentions are rows the Inbox reads`])
  const unguarded = { ...kept(), guards: kept().guards.filter((g) => g.op !== 'note:comment:react') }
  assert.deepEqual(whole(feats(), ops(), unguarded), [
    `${file}: note keeps threads in note.comment but no guard on note:comment:react: a reaction is refused where its circle turned reactions off`,
  ])
  const resolving = ops().map((o) => (o.op === 'note:comment:resolve' ? op(o.op, null) : o))
  assert.deepEqual(whole(feats(), resolving, kept()), [`${file}: note:comment:resolve needs no power, but threads in note.comment is discussed: it needs discuss`])
})

test("a body of text, as a motion's, and comments with no replies, as a document's anchored ones, are not core body's and are not held", () => {
  const other = { columns: [col('note.note.body', 'text'), col('note.comment.quote', 'text')], tables: [{ key: 'note.note' }, { key: 'note.comment' }], guards: [], folds: [] }
  assert.deepEqual(whole(feats(false), [], other), [])
})

// A feat as the scaffold reads it, its record keyed by `id`.
function tree(id = 'text') {
  const repo = mkdtempSync(join(tmpdir(), 'scaffold-'))
  const at = (p, text) => {
    mkdirSync(dirname(join(repo, p)), { recursive: true })
    writeFileSync(join(repo, p), text)
  }
  const ts = 'apps/org/feats/note/core/ts'
  at('apps/org/feat.toml', 'name = "org"\n')
  at('apps/org/feats/note/feat.toml', 'name = "note"\n')
  at(
    'apps/org/feats/note/core/sql/001-note.sql',
    `CREATE SCHEMA note;\n\nCREATE TABLE note.note (\n  circle text NOT NULL DEFAULT circle.assembly() REFERENCES circle.circle,\n  id ${id} PRIMARY KEY,\n  title text NOT NULL\n);\n`,
  )
  at('apps/org/feats/note/core/sql/002-reads.sql', `INSERT INTO cella.reading (what, key, power, owner) VALUES\n  ('note', NULL, 'edit-note', 'note');\n`)
  at(`${ts}/package.json`, JSON.stringify({ name: '@cella/org-note', dependencies: { '@cella/org-db': 'workspace:*', svelte: '5.57.2' } }, null, 2) + '\n')
  at(`${ts}/src/models/actions.ts`, `import { confluent, type Actions } from '@cella/org-actions'\n\nexport const actions = {\n  'note:note:create': confluent({ power: 'edit-note' }),\n} satisfies Actions\n`)
  at(`${ts}/src/models/index.ts`, `export * from './actions.ts'\n`)
  at(
    `${ts}/src/api/index.ts`,
    `import { action, type Slice } from '@cella/org-db'\nimport { create } from '../handlers/index.ts'\nimport { item } from '../drivers/note.ts'\n\nexport { create } from '../handlers/index.ts'\n\nexport const slice: Slice = {\n  name: 'note',\n  collections: {\n    notes: {\n      item,\n      actions: {\n        create: action('note:note:create', (form) => ({ title: form.get('title') }), create),\n      },\n    },\n  },\n}\n`,
  )
  at(
    `${ts}/src/app/index.ts`,
    `import type { App } from '@cella/org-ui'\nimport Create from './blocks/Create.svelte'\n\nexport const app: App = {\n  name: 'note',\n  collections: {\n    notes: {\n      page: {\n        eyebrow: 'Note',\n        title: (n: { title: string }) => n.title,\n      },\n    },\n  },\n}\n`,
  )
  return { repo, ts: join(repo, ts), sql: join(repo, 'apps/org/feats/note/core/sql') }
}

const read = (p) => readFileSync(p, 'utf8')

test('scaffold body writes a feat its body, named for it, into its own folder, and mounts it', () => {
  const t = tree()
  try {
    const written = scaffold(t.repo, 'body', 'note')
    assert.ok(written.includes('apps/org/feats/note/core/sql/003-body.sql'), 'a new migration after the last')
    const sql = read(join(t.sql, '003-body.sql'))
    assert.match(sql, /ALTER TABLE note\.note ADD COLUMN body bytea CHECK \(body IS NULL OR cella\.document_canonical\(body\) IS NOT NULL\);/)
    assert.match(sql, /\('note:body:save', 'discuss', NULL, 'note'\)/)
    assert.match(sql, /cella\.lets_fold\('note:body:save', 1, 'note\.fold_body_save\(jsonb\)', 'note'\)/)
    assert.match(sql, /INSERT INTO cella\.guard \(op, fn, owner\) VALUES \('note:body:save', 'note\.contributed\(jsonb\)', 'note'\)/)
    assert.match(sql, /INSERT INTO cella\.guard \(op, fn, owner\) VALUES \('note:body:save', 'note\.based\(jsonb\)', 'note'\)/)
    assert.match(sql, /WHERE coalesce\(based\.payload ->> 'base', ''\) <> coalesce\(based\.payload ->> 'replaced', ''\);/)
    assert.match(read(join(t.ts, 'src/handlers/body.ts')), /SELECT coalesce\(encode\(sha256\(body\), 'hex'\), ''\) AS replaced FROM note\.note WHERE id = \$1 FOR UPDATE/)
    assert.match(read(join(t.ts, 'src/models/actions.ts')), /'note:body:save': confluent\(\{ power: 'discuss' \}\),\n\} satisfies Actions/)
    const api = read(join(t.ts, 'src/api/index.ts'))
    assert.match(api, /item: withBody\(item\),/)
    assert.match(api, /body: bodyMount,\n\s+actions: \{\n\s+\.\.\.bodyActions,/)
    const app = read(join(t.ts, 'src/app/index.ts'))
    assert.match(app, /import \{ Body \} from '@cella\/org-body\/app'/)
    assert.match(app, /page: \{\n\s+body: Body,/)
    assert.equal(JSON.parse(read(join(t.ts, 'package.json'))).dependencies['@cella/org-body'], 'workspace:*')
    for (const f of ['models/body.ts', 'handlers/body.ts', 'drivers/body.ts', 'api/body.ts']) {
      assert.ok(existsSync(join(t.ts, 'src', f)), f)
    }
    for (const f of ['app/blocks/Body.svelte', 'hooks/useBody.ts', 'hooks/BodyState.svelte.ts']) {
      assert.ok(!existsSync(join(t.ts, 'src', f)), `${f}: core body's own Body is mounted, not copied`)
    }
  } finally {
    rmSync(t.repo, { recursive: true, force: true })
  }
})

test('scaffold comments writes a feat its threads, their tables, commands, guards and folds, the Inbox and the box', () => {
  const t = tree()
  try {
    scaffold(t.repo, 'comments', 'note')
    const sql = read(join(t.sql, '003-comments.sql'))
    for (const table of ['comment', 'mention', 'reaction']) {
      assert.match(sql, new RegExp(`CREATE TABLE note\\.${table} \\(`))
    }
    assert.match(sql, /note text NOT NULL REFERENCES note\.note,/)
    for (const verb of ['post', 'resolve', 'react']) {
      assert.match(sql, new RegExp(`\\('note:comment:${verb}', 'discuss', NULL, 'note'\\)`))
      assert.match(sql, new RegExp(`cella\\.lets_fold\\('note:comment:${verb}', 1, 'note\\.fold_comment_${verb}\\(jsonb\\)', 'note'\\)`))
    }
    assert.match(sql, /\('note:comment:react', 'note\.reacts\(jsonb\)', 'note'\)/)
    const api = read(join(t.ts, 'src/api/index.ts'))
    assert.match(api, /item: withThreads\(item\),/)
    assert.match(api, /extends: \{\n.*\n\s+inbox,\n\s+\},\n\}\n$/)
    assert.match(read(join(t.ts, 'src/drivers/comment.ts')), /ARRAY\['read', 'edit-note'\]/)
    assert.match(read(join(t.ts, 'src/drivers/comment.ts')), /'\/notes\/' \|\| t\.id AS href/)
    assert.match(read(join(t.ts, 'src/app/index.ts')), /page: \{\n\s+comment: Comments,/)
  } finally {
    rmSync(t.repo, { recursive: true, force: true })
  }
})

test('the scaffold refuses a feat that has them already, one keyed otherwise, and one there is not, and writes nothing then', () => {
  const t = tree()
  try {
    scaffold(t.repo, 'body', 'note')
    scaffold(t.repo, 'comments', 'note')
    const before = read(join(t.ts, 'src/api/index.ts'))
    assert.throws(() => scaffold(t.repo, 'body', 'note'), (e) => e instanceof Refused && /note has a body already: its models\/actions\.ts declares note:body:save/.test(e.message))
    assert.throws(() => scaffold(t.repo, 'comments', 'note'), (e) => e instanceof Refused && /note has threads already: its models\/actions\.ts declares note:comment:post/.test(e.message))
    assert.equal(read(join(t.ts, 'src/api/index.ts')), before, 'nothing is written when refused')
    assert.throws(() => scaffold(t.repo, 'body', 'nothing'), /no feat nothing in apps\/\*\/feats/)
    assert.throws(() => scaffold(t.repo, 'replies', 'note'), /replies is no part to scaffold: body or comments/)
  } finally {
    rmSync(t.repo, { recursive: true, force: true })
  }
  const n = tree('bigint')
  try {
    assert.throws(() => scaffold(n.repo, 'body', 'note'), /note\.note is keyed by an id of bigint: the scaffold writes a record keyed by a text id/)
  } finally {
    rmSync(n.repo, { recursive: true, force: true })
  }
})

test('the scaffold as the CLI runs it prints what it wrote, and a refusal exits 1 saying why', () => {
  const t = tree()
  try {
    const out = execFileSync('node', [tool, 'body', 'note', t.repo], { encoding: 'utf8' })
    assert.match(out, /^scaffold: body for note\n {2}apps\/org\/feats\/note\/core\/sql\/003-body\.sql\n/)
    let refused
    try {
      execFileSync('node', [tool, 'body', 'note', t.repo], { encoding: 'utf8', stdio: 'pipe' })
    } catch (e) {
      refused = e
    }
    assert.equal(refused?.status, 1)
    assert.match(refused.stderr, /scaffold: note has a body already/)
  } finally {
    rmSync(t.repo, { recursive: true, force: true })
  }
})
