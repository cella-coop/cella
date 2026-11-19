// scaffold: writes into a feat's own folder what a body or threads of
// comments need, as the task feat's are, named for the feat. `body` adds
// the record's `body` column, `<feat>:body:save`, its power, its guard,
// its fold, the mount handing core body's session its save, and the block
// its page opens on; `comments` adds the comment, mention and reaction
// tables, `<feat>:comment:post`, `:resolve` and `:react`, their powers,
// guards and folds, the mentions in the Inbox, and core body's `Thread`
// under the record's Activity. Each is a new migration of the feat's
// `sql/` and new files of its layers, and a few lines in the files that
// mount them: `models/actions.ts`, `models/index.ts`, `api/index.ts`,
// `app/index.ts` and `package.json`. It refuses a feat that has them
// already, or whose files it cannot place them in, and writes nothing
// then.
//
//   node tools/scaffold.mjs body|comments <feat> [repo]
//
// The record is the feat's table of its own name, `<feat>.<feat>`, keyed
// by a text `id` and named by its `title`; its page is its collection's
// first in `api/index.ts`.

import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'

export class Refused extends Error {}

const refuse = (msg) => {
  throw new Refused(msg)
}

// A feat's folder, at any depth of an app's tree: apps/<app>/feats/…/<feat>.
function locate(repo, feat) {
  const found = []
  const walk = (dir) => {
    for (const e of existsSync(dir) ? readdirSync(dir, { withFileTypes: true }) : []) {
      if (!e.isDirectory() || e.name === 'node_modules') {
        continue
      }
      const sub = join(dir, e.name)
      if (e.name === feat && existsSync(join(sub, 'feat.toml')) && dirname(sub).endsWith('/feats')) {
        found.push(sub)
      }
      if (['apps', 'feats'].includes(e.name) || existsSync(join(sub, 'feat.toml')) || dirname(sub) === join(repo, 'apps')) {
        walk(sub)
      }
    }
  }
  walk(join(repo, 'apps'))
  if (found.length !== 1) {
    refuse(found.length ? `${feat} names ${found.length} feats: ${found.map((f) => relative(repo, f)).join(', ')}` : `no feat ${feat} in apps/*/feats`)
  }
  return found[0]
}

// What the scaffold reads of a feat: its SQL, its record table's key and
// title, its collection, and the powers its reads register.
function read(repo, feat) {
  if (!/^[a-z][a-z0-9]*$/.test(feat)) {
    refuse(`${feat} is no feat's name: a feat's name is unhyphenated lowercase`)
  }
  const dir = locate(repo, feat)
  const sqlDir = join(dir, 'core', 'sql')
  const ts = join(dir, 'core', 'ts')
  for (const f of ['src/models/actions.ts', 'src/models/index.ts', 'src/api/index.ts', 'src/app/index.ts', 'package.json']) {
    if (!existsSync(join(ts, f))) {
      refuse(`${relative(repo, join(ts, f))} is missing: the scaffold mounts what it writes there`)
    }
  }
  const files = existsSync(sqlDir) ? readdirSync(sqlDir).filter((f) => f.endsWith('.sql')).sort() : []
  const sql = files.map((f) => readFileSync(join(sqlDir, f), 'utf8')).join('\n')
  const table = sql.match(new RegExp(`CREATE TABLE ${feat}\\.${feat} \\(([\\s\\S]*?)\\n\\);`))
  if (!table) {
    refuse(`${feat}'s SQL makes no ${feat}.${feat}: the scaffold gives the feat's own record table a body or threads`)
  }
  const id = table[1].match(/^\s*id (\w+)/m)?.[1]
  if (id !== 'text') {
    refuse(`${feat}.${feat} is keyed by ${id ? `an id of ${id}` : 'no id'}: the scaffold writes a record keyed by a text id`)
  }
  if (!/^\s*title text\b/m.test(table[1])) {
    refuse(`${feat}.${feat} has no title: a mention in the Inbox and the editor name the record by it`)
  }
  const api = readFileSync(join(ts, 'src/api/index.ts'), 'utf8')
  const collection = api.match(/collections:\s*\{\s*\n\s*(\w+):\s*\{/)?.[1]
  if (!collection) {
    refuse(`${relative(repo, join(ts, 'src/api/index.ts'))} mounts no collection: the record's page is its collection's`)
  }
  const reading = [...sql.matchAll(new RegExp(`\\('${feat}', NULL, '([a-z-]+)', '${feat}'\\)`, 'g'))].map((m) => m[1])
  const numbers = files.map((f) => Number(f.match(/^(\d+)-/)?.[1])).filter((n) => !Number.isNaN(n))
  return { dir, sqlDir, ts, sql, collection, reading: [...new Set(reading)], next: Math.max(0, ...numbers) + 1, api }
}

const pad = (n) => String(n).padStart(3, '0')

// An edit of a file by an anchor: `at` matched once, replaced by `to`;
// none, and the scaffold says where to add it by hand.
function edit(repo, file, text, at, to, what) {
  if (!at.test(text)) {
    refuse(`${relative(repo, file)}: found no place for ${what}; add it by hand, or write the feat as the scaffold reads it`)
  }
  return text.replace(at, to)
}

// The lines of a feat's `models/actions.ts` for the ops given, before its
// closing `} satisfies Actions`.
function declare(repo, file, text, lines) {
  return edit(repo, file, text, /\n\} satisfies Actions/, `\n${lines.join('\n')}\n} satisfies Actions`, 'its actions')
}

// The last import of a module, after which new ones go.
function imports(repo, file, text, lines) {
  const all = [...text.matchAll(/^import .*$/gm)]
  if (!all.length) {
    refuse(`${relative(repo, file)}: imports nothing to add to`)
  }
  const last = all.at(-1)
  const at = last.index + last[0].length
  return text.slice(0, at) + '\n' + lines.join('\n') + text.slice(at)
}

// The collection's `item`, wrapped by `wrap`, in its slice.
function wrapItem(repo, file, text, wrap) {
  return edit(repo, file, text, /^(\s+)item(?::\s*([^\n]+?))?,$/m, (_, sp, read) => `${sp}item: ${wrap}(${read ?? 'item'}),`, `the collection's item`)
}

// A line inside the first `<key>: {` of a slice, as its first.
function within(repo, file, text, key, line, what) {
  return edit(repo, file, text, new RegExp(`^(\\s+)${key}: \\{$`, 'm'), (_, sp) => `${sp}${key}: {\n${sp}  ${line}`, what)
}

function depend(text) {
  const pkg = JSON.parse(text)
  if (pkg.dependencies?.['@cella/org-body']) {
    return text
  }
  pkg.dependencies = Object.fromEntries(
    Object.entries({ ...pkg.dependencies, '@cella/org-body': 'workspace:*' }).sort(([a], [b]) => (a === 'svelte' ? 1 : b === 'svelte' ? -1 : a.localeCompare(b))),
  )
  return JSON.stringify(pkg, null, 2) + '\n'
}

// The page's blocks: the body first, on its first tab.
function bodyBlock(repo, file, text) {
  if (/^\s+blocks: \[$/m.test(text)) {
    return edit(repo, file, text, /^(\s+)blocks: \[$/m, (_, sp) => `${sp}blocks: [\n${sp}  Body,`, 'the body block')
  }
  if (/^\s+blocks: \[/m.test(text)) {
    return edit(repo, file, text, /^(\s+)blocks: \[/m, (_, sp) => `${sp}blocks: [Body, `, 'the body block')
  }
  return within(repo, file, text, 'page', 'blocks: [Body],', 'the body block')
}

const has = (repo, f, ts, feat, files, ops, keys) => {
  const api = readFileSync(join(ts, 'src/api/index.ts'), 'utf8')
  const key = keys.find((k) => new RegExp(`^\\s+${k}: action\\(`, 'm').test(api))
  if (key) {
    refuse(`${feat}'s collection has a ${key} action already, which the scaffold would mount`)
  }
  const actions = readFileSync(join(ts, 'src/models/actions.ts'), 'utf8')
  const op = ops.find((o) => actions.includes(`'${o}'`))
  if (op) {
    refuse(`${feat} has ${f} already: its models/actions.ts declares ${op}`)
  }
  const file = files.find((x) => existsSync(join(ts, x)))
  if (file) {
    refuse(`${feat} has ${f} already, or a file in its place: ${relative(repo, join(ts, file))}`)
  }
}

// The functions a migration makes, which the feat's SQL must not hold.
function fresh(feat, sql, names) {
  const taken = names.find((n) => new RegExp(`FUNCTION ${feat}\\.${n}\\(`).test(sql))
  if (taken) {
    refuse(`${feat}'s SQL makes ${feat}.${taken} already, which the scaffold would make`)
  }
}

export function scaffold(repo, part, feat) {
  if (!['body', 'comments'].includes(part)) {
    refuse(`${part ?? 'nothing'} is no part to scaffold: body or comments`)
  }
  const f = read(repo, feat)
  const writes = new Map()
  const put = (path, text) => writes.set(path, text)
  const text = (path) => writes.get(path) ?? readFileSync(path, 'utf8')
  const ts = (p) => join(f.ts, p)
  if (part === 'body') {
    has(repo, 'a body', f.ts, feat, ['src/models/body.ts', 'src/handlers/body.ts', 'src/drivers/body.ts', 'src/api/body.ts', 'src/app/blocks/Body.svelte', 'src/hooks/BodyState.svelte.ts', 'src/hooks/useBody.ts'], [`${feat}:body:save`], ['save'])
    if (new RegExp(`ADD COLUMN body\\b|^\\s+body bytea`, 'm').test(f.sql)) {
      refuse(`${feat} has a body already: its SQL makes a body column`)
    }
    fresh(feat, f.sql, ['contributed', 'based', 'fold_body_save'])
    put(join(f.sqlDir, `${pad(f.next)}-body.sql`), bodySql(feat))
    put(ts('src/models/body.ts'), bodyModels(feat))
    put(ts('src/handlers/body.ts'), bodyHandler(feat))
    put(ts('src/drivers/body.ts'), bodyDrivers(feat))
    put(ts('src/api/body.ts'), bodyApi(feat))
    put(ts('src/hooks/BodyState.svelte.ts'), bodyState(feat, f.collection))
    put(ts('src/hooks/useBody.ts'), useBody())
    put(ts('src/app/blocks/Body.svelte'), bodyBlockSvelte(feat))
    put(ts('src/models/actions.ts'), declare(repo, ts('src/models/actions.ts'), text(ts('src/models/actions.ts')), [
      `  // each save carries the whole merged snapshot, so the later receipt holds every edit before it`,
      `  '${feat}:body:save': confluent({ power: 'discuss' }),`,
    ]))
    put(ts('src/models/index.ts'), text(ts('src/models/index.ts')).trimEnd() + `\nexport * from './body.ts'\n`)
    let api = text(ts('src/api/index.ts'))
    api = imports(repo, ts('src/api/index.ts'), api, [`import { bodyActions, bodyMount, withBody } from './body.ts'`])
    api = wrapItem(repo, ts('src/api/index.ts'), api, 'withBody')
    api = within(repo, ts('src/api/index.ts'), api, 'actions', '...bodyActions,', 'the save action')
    api = edit(repo, ts('src/api/index.ts'), api, /^(\s+)actions: \{$/m, (m, sp) => `${sp}body: bodyMount,\n${m}`, 'the body mount')
    api = api.replace(/\n\nexport const slice/, `\nexport { saveBody } from '../handlers/body.ts'\n\nexport const slice`)
    put(ts('src/api/index.ts'), api)
    let app = text(ts('src/app/index.ts'))
    app = imports(repo, ts('src/app/index.ts'), app, [`import Body from './blocks/Body.svelte'`])
    app = bodyBlock(repo, ts('src/app/index.ts'), app)
    put(ts('src/app/index.ts'), app)
  } else {
    has(repo, 'threads', f.ts, feat, ['src/models/comment.ts', 'src/handlers/comment.ts', 'src/drivers/comment.ts', 'src/api/comments.ts', 'src/app/blocks/Comments.svelte'], [`${feat}:comment:post`, `${feat}:comment:resolve`, `${feat}:comment:react`], ['post', 'resolve', 'react'])
    if (new RegExp(`CREATE TABLE ${feat}\\.(comment|mention|reaction) `).test(f.sql)) {
      refuse(`${feat} has threads already: its SQL makes ${feat}.comment, ${feat}.mention or ${feat}.reaction`)
    }
    if (/^\s+inbox:/m.test(f.api)) {
      refuse(`${relative(repo, ts('src/api/index.ts'))} extends the Inbox already: add the mentions to its rows by hand`)
    }
    fresh(feat, f.sql, ['in_its_thread', 'posts', 'resolves', 'reacts', 'fold_comment_post', 'fold_comment_resolve', 'fold_comment_react'])
    put(join(f.sqlDir, `${pad(f.next)}-comments.sql`), commentSql(feat))
    put(ts('src/models/comment.ts'), commentModels(feat))
    put(ts('src/handlers/comment.ts'), commentHandlers(feat))
    put(ts('src/drivers/comment.ts'), commentDrivers(feat, f.collection, f.reading))
    put(ts('src/api/comments.ts'), commentApi(feat))
    put(ts('src/app/blocks/Comments.svelte'), commentsSvelte(feat))
    put(ts('src/models/actions.ts'), declare(repo, ts('src/models/actions.ts'), text(ts('src/models/actions.ts')), [
      `  // a fact: comments are appended, each numbered by receipt`,
      `  '${feat}:comment:post': confluent({ power: 'discuss' }),`,
      `  // resolving a root or reopening it is a register: the last writer wins`,
      `  '${feat}:comment:resolve': confluent({ power: 'discuss' }),`,
      `  // a toggle: one reaction per comment, person and emoji, the last writer wins`,
      `  '${feat}:comment:react': confluent({ power: 'discuss' }),`,
    ]))
    put(ts('src/models/index.ts'), text(ts('src/models/index.ts')).trimEnd() + `\nexport * from './comment.ts'\n`)
    let api = text(ts('src/api/index.ts'))
    api = imports(repo, ts('src/api/index.ts'), api, [`import { commentActions, inbox, withThreads } from './comments.ts'`])
    api = wrapItem(repo, ts('src/api/index.ts'), api, 'withThreads')
    api = within(repo, ts('src/api/index.ts'), api, 'actions', '...commentActions,', 'the comment actions')
    api = /^ {2}extends: \{$/m.test(api)
      ? within(repo, ts('src/api/index.ts'), api, 'extends', '// The mentions waiting on the acting person, in their Inbox.\n    inbox,', 'the Inbox')
      : edit(repo, ts('src/api/index.ts'), api, /\n\}\n?$/, `\n  extends: {\n    // The mentions waiting on the acting person, in their Inbox.\n    inbox,\n  },\n}\n`, 'the Inbox')
    api = api.replace(/\n\nexport const slice/, `\nexport { postComment, reactToComment, resolveComment } from '../handlers/comment.ts'\n\nexport const slice`)
    put(ts('src/api/index.ts'), api)
    let app = text(ts('src/app/index.ts'))
    if (/^\s+comment:/m.test(app)) {
      refuse(`${relative(repo, ts('src/app/index.ts'))}: its page has a comment box already`)
    }
    app = imports(repo, ts('src/app/index.ts'), app, [`import Comments from './blocks/Comments.svelte'`])
    app = within(repo, ts('src/app/index.ts'), app, 'page', 'comment: Comments,', 'the comment box')
    put(ts('src/app/index.ts'), app)
  }
  put(ts('package.json'), depend(text(ts('package.json'))))
  for (const [path, body] of writes) {
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, body)
  }
  return [...writes.keys()].map((p) => relative(repo, p)).sort()
}

// ─── body ───────────────────────────────────────────────────────────────

const bodySql = (F) => `-- ${F}'s body: its free-form content, a Loro snapshot of core body's
-- blocks, set by each save an editor's browser signs, and always one with
-- a canonical form. Saving it needs \`discuss\` in its circle, which every
-- seat there holds. Written by \`cella scaffold body ${F}\`.
ALTER TABLE ${F}.${F} ADD COLUMN body bytea CHECK (body IS NULL OR cella.document_canonical(body) IS NOT NULL);

GRANT UPDATE (body) ON ${F}.${F} TO cella_app;

INSERT INTO cella.power (op, power, amount, owner) VALUES
  ('${F}:body:save', 'discuss', NULL, '${F}');

-- ${F}:body:save: every person its entry names as a contributor since the
-- last save holds \`discuss\` in the ${F}'s circle on the verdict date, as
-- core body's session asks of each at every update; the saver's own power
-- is circle-person's guard's, over the circle the payload names. Refused,
-- it names who does not and what would let them.
CREATE FUNCTION ${F}.contributed(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT 'a body''s save names a contributor who holds no discuss in ' || (contributed.payload ->> 'circle') || ': '
      || string_agg(c, ', ' ORDER BY c) || '; a mandate granting it there, or saving without their edits, would allow it'
  FROM jsonb_array_elements_text(coalesce(contributed.payload -> 'contributors', '[]')) c
  WHERE NOT circle_person.may(c, 'discuss', NULL, contributed.payload ->> 'circle', cella.verdict_date())
  HAVING count(*) > 0;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES ('${F}:body:save', '${F}.contributed(jsonb)', '${F}');

-- ${F}:body:save: the save's snapshot holds the body it replaces. Its
-- \`base\`, the hash of the saved body the browser merged, empty for none,
-- is \`replaced\`, the \`encode(sha256(body), 'hex')\` of the body the ${F}
-- held, which the handler read under the row's lock in the save's own
-- transaction, since at the verdict the row holds the new one. Refused,
-- it names both and what would let it.
CREATE FUNCTION ${F}.based(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT 'a body''s save merged the body hashed ' || coalesce(nullif(based.payload ->> 'base', ''), 'none')
      || ', but the ${F} held the one hashed ' || coalesce(nullif(based.payload ->> 'replaced', ''), 'none')
      || '; merging the saved body into the snapshot and saving again would allow it'
  WHERE coalesce(based.payload ->> 'base', '') <> coalesce(based.payload ->> 'replaced', '');
END;

INSERT INTO cella.guard (op, fn, owner) VALUES ('${F}:body:save', '${F}.based(jsonb)', '${F}');

-- ${F}:body:save: the body set to the snapshot its entry carries, in hex.
CREATE FUNCTION ${F}.fold_body_save(entry jsonb) RETURNS void
LANGUAGE sql
BEGIN ATOMIC
  UPDATE ${F}.${F} SET body = decode(fold_body_save.entry -> 'payload' ->> 'snapshot', 'hex')
  WHERE id = fold_body_save.entry -> 'payload' ->> '${F}';
END;

SELECT cella.lets_fold('${F}:body:save', 1, '${F}.fold_body_save(jsonb)', '${F}');
`

const bodyModels = (F) => `import type { Canon } from '@cella/org-body/models'

// A ${F}'s body, written by \`cella scaffold body ${F}\`: as its page reads
// it, a Loro snapshot in base64, which the browser's editor opens, and its
// canonical form, which the page draws until it does, null both where it
// has none yet; and an editor's save of it, the merged snapshot as its
// browser holds it, the hash of the saved body it merged, empty for
// none, and who contributed since the last save, by address.

export interface Bodied {
  snapshot: string | null
  canon: Canon | null
}

export interface BodySave {
  ${F}: string
  snapshot: Uint8Array
  base: string
  contributors: string[]
}

export interface BodySaved {
  ${F}: string
  circle: string
}
`

const bodyHandler = (F) => `import type { Outcome } from '@cella/org-actions'
import { write, type Deps } from '@cella/org-db'
import type { actions } from '../models/actions.ts'
import type { BodySave, BodySaved } from '../models/body.ts'

type Action = keyof typeof actions

// Saves a ${F}'s body: the merged snapshot an editor's browser signs, with
// who contributed since the last save, each of whom the feat's guard asks
// holds \`discuss\` in the ${F}'s circle, as the saver must. The payload
// names the circle the handler read, which the power's guard reads. Its
// \`base\`, the hash of the saved body the browser merged, goes in the
// payload with \`replaced\`, the hash of the body it replaces, read under
// the row's lock; the feat's guard refuses the save where they differ,
// so a stale snapshot never erases another editor's save. A snapshot
// with no canonical form is refused by the column.
export async function saveBody(input: BodySave, deps: Deps): Promise<Outcome<(typeof actions)['${F}:body:save'], BodySaved>> {
  let snapshot = ''
  let replaced = ''
  return write(deps, {
    op: '${F}:body:save' satisfies Action,
    request: input,
    state: async (tx) => {
      const held = await tx.query<{ replaced: string }>(
        \`SELECT coalesce(encode(sha256(body), 'hex'), '') AS replaced FROM ${F}.${F} WHERE id = $1 FOR UPDATE\`,
        [input.${F}],
      )
      replaced = held.rows[0]?.replaced ?? ''
      const { rows } = await tx.query<{ circle: string; snapshot: string }>(
        \`UPDATE ${F}.${F} SET body = $2 WHERE id = $1 RETURNING circle, encode(body, 'hex') AS snapshot\`,
        [input.${F}, input.snapshot],
      )
      if (!rows[0]) {
        throw new Error(\`no ${F} \${input.${F}}\`)
      }
      snapshot = rows[0].snapshot
      return { ${F}: input.${F}, circle: rows[0].circle }
    },
    // The log keeps the snapshot, in hex, which its fold sets the body to,
    // the base it was merged from and the hash of the body it replaced, and
    // who contributed to it since the last.
    payload: (v) => ({ ...v, snapshot, base: input.base, replaced, contributors: [...new Set(input.contributors)].sort() }),
  })
}
`

const bodyDrivers = (F) => `import type { Db } from '@cella/org-db'
import { b64, type Canon } from '@cella/org-body/models'
import type { Bodied } from '../models/body.ts'

// A ${F}'s body as its page reads it: its snapshot and its canonical form.
export async function bodied(db: Db, id: string): Promise<Bodied> {
  const { rows } = await db.query<{ body: Uint8Array | null; canon: string | null }>(
    'SELECT body, cella.document_canonical(body) AS canon FROM ${F}.${F} WHERE id = $1',
    [id],
  )
  const body = rows[0]?.body
  const canon = rows[0]?.canon
  return { snapshot: body ? b64.encode(new Uint8Array(body)) : null, canon: canon ? (JSON.parse(canon) as Canon) : null }
}

// What core body's session reads of a ${F}: its circle, and its saved
// body, as the reader sees them.
export async function bodyCircle(db: Db, id: string): Promise<string | null> {
  const { rows } = await db.query<{ circle: string }>('SELECT circle FROM ${F}.${F} WHERE id = $1', [id])
  return rows[0]?.circle ?? null
}

export async function savedBody(db: Db, id: string): Promise<Uint8Array | null> {
  const { rows } = await db.query<{ body: Uint8Array | null }>('SELECT body FROM ${F}.${F} WHERE id = $1', [id])
  return rows[0]?.body ? new Uint8Array(rows[0].body) : null
}
`

const bodyApi = (F) => `import { action, type Body, type Db, type Form } from '@cella/org-db'
import { b64 } from '@cella/org-body/models'
import type { BodySave } from '../models/body.ts'
import { saveBody } from '../handlers/body.ts'
import { bodied, bodyCircle, savedBody } from '../drivers/body.ts'

// A ${F}'s body, written by \`cella scaffold body ${F}\`: the save its
// page's editor posts, the mount handing core body's session the ${F}'s
// bodies and that save, and its page's item with its body.

// An editor's save, as its browser posts it: the merged snapshot in
// base64 in \`snapshot\`, the hash of the saved body it merged in \`base\`,
// and one \`contributor\` an address.
export function saving(form: Form, id: string): BodySave {
  const snapshot = form.get('snapshot')
  if (!snapshot) {
    throw new Error('a save carries the body’s snapshot')
  }
  return { ${F}: id, snapshot: b64.decode(snapshot), base: form.get('base'), contributors: form.all('contributor') }
}

export const bodyActions = {
  save: action('${F}:body:save', (form, id) => saving(form, id ?? ''), saveBody),
}

export const bodyMount: Body = { circle: bodyCircle, saved: savedBody, save: 'save' }

export const withBody =
  <T extends object>(read: (db: Db, id: string, query?: URLSearchParams) => Promise<T | null>) =>
  async (db: Db, id: string, query?: URLSearchParams): Promise<(T & Awaited<ReturnType<typeof bodied>>) | null> => {
    const item = await read(db, id, query)
    return item && { ...item, ...(await bodied(db, id)) }
  }
`

const bodyState = (F, collection) => `import { onMount, untrack } from 'svelte'
import { b64, canonical, createDoc, type Canon, type LoroDoc } from '@cella/org-body/models'
import { LiveState } from '@cella/org-body/app'
import { useWrites } from '@cella/org-ui'
import type { Bodied } from '../models/body.ts'

type Page = Bodied & { id: string }

// A ${F}'s body in the browser: a Loro document made from the page's
// snapshot as the body mounts, kept live over core body's session until
// it unmounts, and saved by this browser through the ${F}'s \`save\` write,
// signed by its device. When a write refreshes the page, its snapshot is
// merged in, which Loro does without changing what is already there.
export class BodyState {
  readonly #page: () => Page
  doc: LoroDoc | null = $state.raw(null)
  live: LiveState | null = $state.raw(null)

  constructor(page: () => Page) {
    this.#page = page
    const writes = useWrites()
    onMount(() => {
      const doc = createDoc()
      const snapshot = this.#page().snapshot
      if (snapshot) {
        doc.import(b64.decode(snapshot))
      }
      const id = this.#page().id
      const live = new LiveState(doc, {
        live: () => \`/${collection}/\${encodeURIComponent(id)}/body/live\`,
        save: (write, fields) => writes.send(write, fields, id, '${collection}'),
      })
      const stop = live.start()
      this.doc = doc
      this.live = live
      return () => {
        stop()
        this.doc = null
        this.live = null
      }
    })
    $effect(() => {
      const snapshot = this.#page().snapshot
      if (snapshot) {
        untrack(() => this.doc)?.import(b64.decode(snapshot))
      }
    })
  }

  // The body as it reads now: the live document's, which follows every
  // edit that reaches this browser, or the page's until it holds one.
  get canon(): Canon | null {
    const live = this.live
    if (!live || !this.doc) {
      return this.#page().canon
    }
    void live.hash
    return canonical(this.doc)
  }
}
`

const useBody = () => `import { createContext } from 'svelte'
import type { Bodied } from '../models/body.ts'
import { BodyState } from './BodyState.svelte.ts'

const [get, set, has] = createContext<BodyState>()

export function useBody(page: () => Bodied & { id: string }): BodyState {
  if (has()) {
    return get()
  }
  return set(new BodyState(page))
}
`

const bodyBlockSvelte = (F) => `<script lang="ts">
  import { Note, type Embeds } from '@cella/org-ui'
  import { Editor, Reader } from '@cella/org-body/app'
  import type { Bodied } from '../../models/body.ts'
  import { useBody } from '../../hooks/useBody.ts'

  // The ${F}'s body, its free-form content, edited together over core
  // body's live session: every member with it open sees the others' edits
  // as they make them, and each browser saves at a pause and on leaving.
  // The server renders it to read; the editor takes it over once the
  // session says this member may edit it, and one who may read the ${F}
  // and not discuss it reads it as it changes. Over it, whether this
  // member's edits are saved, and how a block is added.
  let { data, embeds = {} }: { data: Bodied & { id: string; title: string }; id: string; embeds?: Embeds } = $props()

  const body = useBody(() => data)
  const canon = $derived(body.canon ?? { v: 1 as const, blocks: [] })
  const state = $derived.by(() => {
    const l = body.live
    if (!l || !l.joined) {
      return 'opening'
    }
    if (l.problem) {
      return \`not saved: \${l.problem}\`
    }
    if (!l.writable) {
      return 'read-only'
    }
    if (!l.online) {
      return l.unsaved ? 'offline, edits wait' : 'offline'
    }
    return l.unsaved ? 'saving' : 'saved'
  })
  const note = $derived(
    state === 'opening' ? 'Opening the body' : !body.live?.writable ? (body.live?.problem ?? 'Read-only: editing it needs discuss in its circle') : \`Edits \${state} · type / for blocks\`,
  )
</script>

<div data-body={body.live?.writable ? 'edit' : 'read'} data-hash={body.live?.hash ?? ''} data-state={state}>
  <Note text={note} />
</div>
{#if body.doc && body.live?.writable}
  <Editor doc={body.doc} name={data.title} {embeds} />
{:else}
  <Reader {canon} label={data.title} {embeds} readonly={!!body.live?.joined} />
{/if}
`

// ─── comments ───────────────────────────────────────────────────────────

const emojis = `'👍', '❤️', '😄', '🎉', '👀', '🙏'`

const commentSql = (F) => `-- ${F}'s threads, written by \`cella scaffold comments ${F}\`.
--
-- A comment on a ${F}, under the receipt of the write that posted it: a
-- root, or a reply to a root of the same ${F}, never to a reply, so
-- replies are flat, one level. Only a root is resolved, on its day, and a
-- new reply reopens it. Its text is its author's free text, a mention in
-- it \`@[address]\`; \`${F}.mention\` holds who each names. It is in its
-- ${F}'s circle, copied as it is made.
CREATE TABLE ${F}.comment (
  circle text NOT NULL DEFAULT circle.assembly() REFERENCES circle.circle,
  id bigint PRIMARY KEY,
  ${F} text NOT NULL REFERENCES ${F}.${F},
  author text NOT NULL REFERENCES person.person,
  parent bigint,
  text text NOT NULL CHECK (btrim(text) <> ''),
  posted date NOT NULL,
  resolved date,
  UNIQUE (${F}, id),
  FOREIGN KEY (${F}, parent) REFERENCES ${F}.comment (${F}, id),
  CHECK (parent < id),
  CHECK (parent IS NULL OR resolved IS NULL)
);

CREATE INDEX ON ${F}.comment (${F});

-- Each person a comment's text mentions, \`n\` the place of the mention in
-- it, by their address, the pseudonym every entry names them by: the
-- thread draws them by their name as it stands.
CREATE TABLE ${F}.mention (
  circle text NOT NULL DEFAULT circle.assembly() REFERENCES circle.circle,
  comment bigint NOT NULL REFERENCES ${F}.comment,
  n integer NOT NULL CHECK (n > 0),
  person text NOT NULL REFERENCES person.person,
  PRIMARY KEY (comment, n),
  UNIQUE (comment, person)
);

CREATE INDEX ON ${F}.mention (person);

-- A person's reaction to a comment, one of core body's fixed six: one row
-- per comment, person and emoji, there while it is on, the person by
-- their address. It is in its comment's circle, copied as it is made.
CREATE TABLE ${F}.reaction (
  circle text NOT NULL DEFAULT circle.assembly() REFERENCES circle.circle,
  comment bigint NOT NULL REFERENCES ${F}.comment,
  person text NOT NULL REFERENCES person.person,
  emoji text NOT NULL CHECK (emoji IN (${emojis})),
  PRIMARY KEY (comment, person, emoji)
);

CREATE FUNCTION ${F}.in_its_thread() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'comment' THEN
    NEW.circle := coalesce((SELECT t.circle FROM ${F}.${F} t WHERE t.id = NEW.${F}), NEW.circle);
  ELSE
    NEW.circle := coalesce((SELECT c.circle FROM ${F}.comment c WHERE c.id = NEW.comment), NEW.circle);
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER in_its_thread BEFORE INSERT ON ${F}.comment
  FOR EACH ROW EXECUTE FUNCTION ${F}.in_its_thread();

CREATE TRIGGER in_its_thread BEFORE INSERT ON ${F}.mention
  FOR EACH ROW EXECUTE FUNCTION ${F}.in_its_thread();

CREATE TRIGGER in_its_thread BEFORE INSERT ON ${F}.reaction
  FOR EACH ROW EXECUTE FUNCTION ${F}.in_its_thread();

GRANT SELECT, INSERT ON ${F}.comment, ${F}.mention TO cella_app;
GRANT UPDATE (resolved) ON ${F}.comment TO cella_app;
GRANT SELECT, INSERT, DELETE ON ${F}.reaction TO cella_app;
GRANT SELECT ON ${F}.comment, ${F}.mention, ${F}.reaction TO cella_guards;

-- Posting, resolving and reacting need \`discuss\` in the ${F}'s circle,
-- which every seat there holds.
INSERT INTO cella.power (op, power, amount, owner) VALUES
  ('${F}:comment:post', 'discuss', NULL, '${F}'),
  ('${F}:comment:resolve', 'discuss', NULL, '${F}'),
  ('${F}:comment:react', 'discuss', NULL, '${F}');

-- ${F}:comment:post: the comment is the actor's own, and is what its
-- payload names: its ${F}, its parent, its text and its mentions, each in
-- the order its text gives them. A reply answers a root: a reply to a
-- reply is refused, naming the root to reply to, as is a mention of no
-- one the coop knows. That the actor may discuss in the ${F}'s circle is
-- the power's guard's, over the circle the payload names.
CREATE FUNCTION ${F}.posts(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN c.id IS NULL THEN 'no comment ' || coalesce(p.comment, 'is named')
    WHEN r.parent IS NOT NULL THEN 'comment ' || r.id || ' is a reply: reply to its root, comment ' || r.parent
    WHEN u.person IS NOT NULL THEN '@[' || u.person || '] names no one the coop knows: mention someone the picker offers'
    WHEN c.author IS DISTINCT FROM cella.actor() THEN cella.actor() || ' may not post as ' || c.author
    WHEN c.${F} IS DISTINCT FROM p.${F}
      OR c.parent IS DISTINCT FROM p.parent
      OR c.text IS DISTINCT FROM p.text
      OR ARRAY(SELECT m.person FROM ${F}.mention m WHERE m.comment = c.id ORDER BY m.n)
         IS DISTINCT FROM ARRAY(SELECT jsonb_array_elements_text(coalesce(p.mentions, '[]')))
      THEN 'comment ' || c.id || ' was posted otherwise than its payload names'
  END
  FROM (
    SELECT payload ->> 'comment' AS comment, payload ->> '${F}' AS ${F}, (payload ->> 'parent')::bigint AS parent,
           payload ->> 'text' AS text, payload -> 'mentions' AS mentions
  ) p
  LEFT JOIN ${F}.comment c ON c.id::text = p.comment
  LEFT JOIN ${F}.comment r ON r.id = c.parent
  LEFT JOIN LATERAL (
    SELECT x.person FROM jsonb_array_elements_text(coalesce(p.mentions, '[]')) AS x (person)
    WHERE NOT EXISTS (SELECT FROM person.person q WHERE q.address = x.person)
    LIMIT 1
  ) u ON true;
END;

-- ${F}:comment:resolve: only a root is resolved or reopened; resolving a
-- reply is refused, naming its root.
CREATE FUNCTION ${F}.resolves(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN c.id IS NULL THEN 'no comment ' || coalesce(p.comment, 'is named')
    WHEN c.parent IS NOT NULL THEN 'comment ' || c.id || ' is a reply: resolve its root, comment ' || c.parent
  END
  FROM (SELECT payload ->> 'comment' AS comment) p
  LEFT JOIN ${F}.comment c ON c.id::text = p.comment;
END;

-- ${F}:comment:react: a reaction is one of core body's fixed six, to a
-- comment there is, and is what its payload names, the actor's own on or
-- off; it is refused where the comment's circle has \`reactions\` off
-- (\`circle.setting_of\`), naming the circle and the rule that turned them
-- off and what would turn them on. That the actor may discuss in the
-- ${F}'s circle is the power's guard's.
CREATE FUNCTION ${F}.reacts(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN c.id IS NULL THEN 'no comment ' || coalesce(p.comment, 'is named')
    WHEN p.emoji IS NULL OR p.emoji NOT IN (${emojis})
      THEN coalesce(p.emoji, 'nothing') || ' is no reaction: react with one of 👍 ❤️ 😄 🎉 👀 🙏'
    WHEN circle.setting_of(c.circle, 'reactions') = 'off'
      THEN 'reactions are off in ' || c.circle || coalesce(', by rule ' || s.policy || CASE s.set_by WHEN 'assembly' THEN ' of the assembly' ELSE '' END, '')
        || ': a rule turning them on, adopted by motion, lets a comment take them'
    WHEN p.turned IS NULL THEN 'a reaction is on or off'
    WHEN p.turned <> EXISTS (SELECT FROM ${F}.reaction r WHERE r.comment = c.id AND r.person = cella.actor() AND r.emoji = p.emoji)
      THEN 'the reaction to comment ' || c.id || ' is not ' || CASE WHEN p.turned THEN 'on' ELSE 'off' END || ' as its payload names'
  END
  FROM (SELECT payload ->> 'comment' AS comment, payload ->> 'emoji' AS emoji, (payload ->> 'on')::boolean AS turned) p
  LEFT JOIN ${F}.comment c ON c.id::text = p.comment
  LEFT JOIN LATERAL (SELECT x.policy, x.set_by FROM circle.settings(c.circle) x WHERE x.name = 'reactions') s ON true;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES
  ('${F}:comment:post', '${F}.posts(jsonb)', '${F}'),
  ('${F}:comment:resolve', '${F}.resolves(jsonb)', '${F}'),
  ('${F}:comment:react', '${F}.reacts(jsonb)', '${F}');

-- ${F}:comment:post: the comment under the receipt its entry names, by
-- its actor on its day, in its ${F}'s circle, and each mention its entry
-- names in order; a reply reopens its root.
CREATE FUNCTION ${F}.fold_comment_post(entry jsonb) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  p jsonb := entry -> 'payload';
BEGIN
  INSERT INTO ${F}.comment (id, ${F}, author, parent, text, posted)
  VALUES ((p ->> 'comment')::bigint, p ->> '${F}', entry ->> 'actor', (p ->> 'parent')::bigint, p ->> 'text', (entry ->> 'date')::date);
  INSERT INTO ${F}.mention (comment, n, person)
  SELECT (p ->> 'comment')::bigint, m.n, m.person
  FROM jsonb_array_elements_text(coalesce(p -> 'mentions', '[]')) WITH ORDINALITY AS m (person, n);
  UPDATE ${F}.comment SET resolved = NULL WHERE id = (p ->> 'parent')::bigint AND resolved IS NOT NULL;
END
$$;

-- ${F}:comment:resolve: the root resolved on the entry's day, or
-- reopened.
CREATE FUNCTION ${F}.fold_comment_resolve(entry jsonb) RETURNS void
LANGUAGE sql
BEGIN ATOMIC
  UPDATE ${F}.comment
  SET resolved = CASE WHEN (fold_comment_resolve.entry -> 'payload' ->> 'resolved')::boolean THEN (fold_comment_resolve.entry ->> 'date')::date END
  WHERE id = (fold_comment_resolve.entry -> 'payload' ->> 'comment')::bigint;
END;

-- ${F}:comment:react: the actor's reaction to the comment its entry
-- names, on or off as it says.
CREATE FUNCTION ${F}.fold_comment_react(entry jsonb) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  p jsonb := entry -> 'payload';
BEGIN
  IF (p ->> 'on')::boolean THEN
    INSERT INTO ${F}.reaction (comment, person, emoji) VALUES ((p ->> 'comment')::bigint, entry ->> 'actor', p ->> 'emoji')
    ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM ${F}.reaction WHERE comment = (p ->> 'comment')::bigint AND person = entry ->> 'actor' AND emoji = p ->> 'emoji';
  END IF;
END
$$;

SELECT cella.lets_fold('${F}:comment:post', 1, '${F}.fold_comment_post(jsonb)', '${F}');
SELECT cella.lets_fold('${F}:comment:resolve', 1, '${F}.fold_comment_resolve(jsonb)', '${F}');
SELECT cella.lets_fold('${F}:comment:react', 1, '${F}.fold_comment_react(jsonb)', '${F}');
`

const commentModels = (F) => `import type { Comment, Named } from '@cella/org-body/models'

// A ${F}'s threads, written by \`cella scaffold comments ${F}\`: as its
// page reads them, its comments oldest first, the people who may read it,
// whom a mention may name, whether the reader may discuss it, posting,
// resolving and reacting, and whether its circle has reactions on; and
// the writes: a root or a reply to a root, its text the author's, each
// \`@[address]\` in it a mention of a core person; a root resolved or
// reopened; and a reaction toggled.

export interface Threaded {
  comments: Comment[]
  readers: Named[]
  discuss: boolean
  reactions: boolean
}

export interface CommentPost {
  ${F}: string
  // The root it replies to, or null for a root.
  parent: number | null
  text: string
}

export interface CommentPosted {
  ${F}: string
  comment: number
  circle: string
}

export interface CommentResolve {
  comment: number
  // True to resolve the root, false to reopen it.
  resolved: boolean
}

// A reaction of the actor's to a comment, one of core body's six, turned
// on or off.
export interface CommentReact {
  comment: number
  emoji: string
  on: boolean
}

export interface CommentDone {
  comment: number
  ${F}: string
  circle: string
}
`

const commentHandlers = (F) => `import type { Outcome } from '@cella/org-actions'
import { write, type Deps } from '@cella/org-db'
import { thread } from '@cella/org-body/models'
import type { actions } from '../models/actions.ts'
import type { CommentDone, CommentPost, CommentPosted, CommentReact, CommentResolve } from '../models/comment.ts'

type Action = keyof typeof actions
type Out<O extends Action, T> = Promise<Outcome<(typeof actions)[O], T>>

// Posts a comment on a ${F} as the actor, under its write's receipt, in
// the ${F}'s circle, which the payload names for the power's guard: a
// root, or a reply to a root, which reopens it. Each \`@[address]\` its
// text gives is a mention, a row each in the order given, of a person the
// coop knows; \`${F}.posts\` refuses a reply to a reply, naming the root, a
// mention of no one, and a post naming otherwise than its rows. The text
// is its author's free text, and the log keeps it as written.
export async function postComment(input: CommentPost, deps: Deps): Out<'${F}:comment:post', CommentPosted> {
  const mentions = thread.mentioned(input.text)
  return write(deps, {
    op: '${F}:comment:post' satisfies Action,
    request: input,
    state: async (tx) => {
      const { rows } = await tx.query<{ id: string; circle: string }>(
        \`INSERT INTO ${F}.comment (id, ${F}, author, parent, text, posted)
         VALUES (cella.receipt(), $1, $2, $3, $4, cella.verdict_date())
         RETURNING id, circle\`,
        [input.${F}, deps.actor, input.parent, input.text],
      )
      const comment = Number(rows[0].id)
      for (const [i, person] of mentions.entries()) {
        await tx.query(
          'INSERT INTO ${F}.mention (comment, n, person) SELECT $1, $2, $3 WHERE EXISTS (SELECT FROM person.person WHERE address = $3)',
          [comment, i + 1, person],
        )
      }
      if (input.parent !== null) {
        await tx.query('UPDATE ${F}.comment SET resolved = NULL WHERE id = $1 AND resolved IS NOT NULL', [input.parent])
      }
      return { ${F}: input.${F}, comment, circle: rows[0].circle }
    },
    payload: (v) => ({ ...v, parent: input.parent, text: input.text, mentions }),
  })
}

// Resolves a ${F}'s root comment on the verdict date, or reopens it; the
// last write wins. \`${F}.resolves\` refuses a reply, naming its root.
export async function resolveComment(input: CommentResolve, deps: Deps): Out<'${F}:comment:resolve', CommentDone> {
  return write(deps, {
    op: '${F}:comment:resolve' satisfies Action,
    request: input,
    state: async (tx) => {
      const { rows } = await tx.query<{ ${F}: string; circle: string }>(
        \`UPDATE ${F}.comment SET resolved = CASE WHEN parent IS NULL AND $2 THEN cella.verdict_date() END
         WHERE id = $1 RETURNING ${F}, circle\`,
        [input.comment, input.resolved],
      )
      if (!rows[0]) {
        throw new Error(\`no comment \${input.comment}\`)
      }
      return { comment: input.comment, ${F}: rows[0].${F}, circle: rows[0].circle }
    },
    payload: (v) => ({ ...v, resolved: input.resolved }),
  })
}

// Turns the actor's reaction to a ${F}'s comment on or off; the last write
// wins. \`${F}.reacts\` refuses an emoji not of core body's six, and any
// reaction where the comment's circle has \`reactions\` off, naming the
// circle and the rule that turned them off.
export async function reactToComment(input: CommentReact, deps: Deps): Out<'${F}:comment:react', CommentDone> {
  return write(deps, {
    op: '${F}:comment:react' satisfies Action,
    request: input,
    state: async (tx) => {
      const { rows } = await tx.query<{ ${F}: string; circle: string }>('SELECT ${F}, circle FROM ${F}.comment WHERE id = $1', [input.comment])
      if (!rows[0]) {
        throw new Error(\`no comment \${input.comment}\`)
      }
      if (input.on) {
        await tx.query('INSERT INTO ${F}.reaction (comment, person, emoji) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [
          input.comment,
          deps.actor,
          input.emoji,
        ])
      } else {
        await tx.query('DELETE FROM ${F}.reaction WHERE comment = $1 AND person = $2 AND emoji = $3', [input.comment, deps.actor, input.emoji])
      }
      return { comment: input.comment, ${F}: rows[0].${F}, circle: rows[0].circle }
    },
    payload: (v) => ({ ...v, emoji: input.emoji, on: input.on }),
  })
}
`

const commentDrivers = (F, collection, reading) => `import type { Db, Read } from '@cella/org-db'
import type { Comment, Named } from '@cella/org-body/models'
import type { Threaded } from '../models/comment.ts'

// A ${F}'s comments, oldest first, each with its author's name, the names
// of those it mentions as they stand now, \`redacted\` once erased, and its
// reactions, each emoji given with its count and whether the reader gave
// it.
export async function comments(db: Db, id: string): Promise<Comment[]> {
  const { rows } = await db.query<Omit<Comment, 'id' | 'parent'> & { id: string; parent: string | null }>(
    \`SELECT c.id, c.author, a.name, c.parent, c.text, to_char(c.posted, 'YYYY-MM-DD') AS posted,
            to_char(c.resolved, 'YYYY-MM-DD') AS resolved,
            coalesce((SELECT json_agg(json_build_object('person', m.person, 'name', p.name) ORDER BY m.n)
                      FROM ${F}.mention m LEFT JOIN person.person p ON p.address = m.person
                      WHERE m.comment = c.id), '[]') AS mentions,
            coalesce((SELECT json_agg(json_build_object('emoji', r.emoji, 'count', r.count, 'mine', r.mine) ORDER BY r.emoji)
                      FROM (SELECT x.emoji, count(*)::int AS count, bool_or(x.person = cella.reader()) AS mine
                            FROM ${F}.reaction x WHERE x.comment = c.id GROUP BY x.emoji) r), '[]') AS reactions
     FROM ${F}.comment c LEFT JOIN person.person a ON a.address = c.author
     WHERE c.${F} = $1 ORDER BY c.id\`,
    [id],
  )
  return rows.map((r) => ({ ...r, id: Number(r.id), parent: r.parent === null ? null : Number(r.parent) }))
}

// Who may read a ${F}, whom a mention of it may name: each person, but one
// erased, holding \`read\` over its circle today, or a power the feat's
// reads register.
export async function readers(db: Db, id: string): Promise<Named[]> {
  const { rows } = await db.query<Named>(
    \`SELECT p.address AS person, p.name FROM person.person p, ${F}.${F} t
     WHERE t.id = $1 AND p.name <> 'redacted'
       AND EXISTS (SELECT FROM unnest(ARRAY[${['read', ...reading].map((r) => `'${r}'`).join(', ')}]) AS w (power)
                   WHERE circle_person.may(p.address, w.power, NULL, t.circle, cella.verdict_date()))
     ORDER BY p.name, p.address\`,
    [id],
  )
  return rows
}

// Whether the reader may discuss a ${F}, by \`discuss\` over its circle
// today, and whether its comments take reactions, by its circle's
// \`reactions\` setting.
async function may(db: Db, id: string): Promise<{ discuss: boolean; reactions: boolean }> {
  const { rows } = await db.query<{ discuss: boolean; reactions: boolean }>(
    \`SELECT circle_person.may(cella.reader(), 'discuss', NULL, t.circle, cella.verdict_date()) AS discuss,
            circle.setting_of(t.circle, 'reactions') = 'on' AS reactions
     FROM ${F}.${F} t WHERE t.id = $1\`,
    [id],
  )
  return rows[0] ?? { discuss: false, reactions: false }
}

// A ${F}'s threads as its page reads them.
export async function threaded(db: Db, id: string): Promise<Threaded> {
  return { comments: await comments(db, id), readers: await readers(db, id), ...(await may(db, id)) }
}

// The mentions waiting on the reader, in their Inbox: each mention of them
// in a ${F}'s comment by someone else, in a thread not resolved, which
// they have not answered by a comment of their own in that thread since;
// in the order posted.
export const mentions: Read = {
  sql: \`SELECT 'mention/${F}/' || c.id || '/' || m.n AS id, 'mention' AS kind,
               coalesce(a.name, c.author) || ' mentioned you on ' || t.title AS what, t.id AS about,
               to_char(c.posted, 'YYYY-MM-DD') AS since, NULL::text AS due,
               '/${collection}/' || t.id AS href, c.id AS comment
        FROM ${F}.mention m
        JOIN ${F}.comment c ON c.id = m.comment
        JOIN ${F}.${F} t ON t.id = c.${F}
        JOIN ${F}.comment r ON r.id = coalesce(c.parent, c.id)
        LEFT JOIN person.person a ON a.address = c.author
        WHERE m.person = cella.reader() AND c.author <> cella.reader() AND r.resolved IS NULL
          AND NOT EXISTS (SELECT FROM ${F}.comment y WHERE coalesce(y.parent, y.id) = r.id AND y.author = cella.reader() AND y.id > c.id)\`,
  order: 'comment',
}
`

const commentApi = (F) => `import { action, type Db, type Form } from '@cella/org-db'
import type { CommentPost, CommentReact, CommentResolve, Threaded } from '../models/comment.ts'
import { postComment, reactToComment, resolveComment } from '../handlers/comment.ts'
import { mentions, threaded } from '../drivers/comment.ts'

// A ${F}'s threads, written by \`cella scaffold comments ${F}\`: the writes
// its page's box posts, its page's item with its threads, and the
// mentions waiting in the Inbox.

// A comment as its box posts it: its text, each mention \`@[address]\` in
// it, and the root it replies to in \`parent\`, empty for a root.
export function posting(form: Form, id: string): CommentPost {
  const text = form.get('text')
  if (!text.trim()) {
    throw new Error('a comment says something: type it in the box')
  }
  const parent = form.get('parent')
  if (parent && !/^\\d+$/.test(parent)) {
    throw new Error(\`“\${parent}” is no comment to reply to\`)
  }
  return { ${F}: id, parent: parent ? Number(parent) : null, text }
}

// A root resolved, \`resolved\` set, or reopened, \`resolved\` empty.
export function resolving(form: Form): CommentResolve {
  const comment = form.get('comment')
  if (!/^\\d+$/.test(comment)) {
    throw new Error(\`“\${comment}” is no comment to resolve\`)
  }
  return { comment: Number(comment), resolved: form.get('resolved') === 'true' }
}

// A reaction toggled: the comment, the emoji, and \`on\` set to turn it on
// or empty to turn it off.
export function reacting(form: Form): CommentReact {
  const comment = form.get('comment')
  if (!/^\\d+$/.test(comment)) {
    throw new Error(\`“\${comment}” is no comment to react to\`)
  }
  return { comment: Number(comment), emoji: form.get('emoji'), on: form.get('on') === 'true' }
}

export const commentActions = {
  post: action('${F}:comment:post', (form, id) => posting(form, id ?? ''), postComment),
  resolve: action('${F}:comment:resolve', (form) => resolving(form), resolveComment),
  react: action('${F}:comment:react', (form) => reacting(form), reactToComment),
}

export const inbox = { rows: mentions }

export const withThreads =
  <T extends object>(read: (db: Db, id: string, query?: URLSearchParams) => Promise<T | null>) =>
  async (db: Db, id: string, query?: URLSearchParams): Promise<(T & Threaded) | null> => {
    const item = await read(db, id, query)
    return item && { ...item, ...(await threaded(db, id)) }
  }
`

const commentsSvelte = (F) => `<script lang="ts">
  import { Threads } from '@cella/org-body/app'
  import type { Threaded } from '../../models/comment.ts'

  // The ${F}'s threads under its Activity, in core body's \`Threads\`, with
  // the box that posts a comment and its mention picker, through the
  // ${F}'s \`post\` and \`resolve\` writes, and each comment's reactions,
  // toggled through \`react\`, where its circle has them on; one who may
  // not discuss the ${F} reads them and has no box.
  let { data }: { data: Threaded; id: string } = $props()
</script>

<Threads comments={data.comments} readers={data.readers} discuss={data.discuss} post="post" resolve="resolve" react="react" reactions={data.reactions} />
`

const main = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href
if (main) {
  const [part, feat, repo = process.cwd()] = process.argv.slice(2)
  try {
    const written = scaffold(repo, part, feat)
    console.log(`scaffold: ${part} for ${feat}\n${written.map((w) => `  ${w}`).join('\n')}\nThe feat's doc is yours to update: say what its body or threads are.`)
  } catch (e) {
    if (e instanceof Refused) {
      console.error(`scaffold: ${e.message}`)
      process.exit(1)
    }
    throw e
  }
}
