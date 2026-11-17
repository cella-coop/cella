// The task feat's folds (`sql/005-folds.sql`), on a database holding the
// app's core and this feat, in a transaction rolled back after: a task
// folds created under its id on the entry's day, its title as its
// commitment; moved, completed keeping its first day, and reopened; its
// body set to each save's snapshot, one with no canonical form refused,
// and a save refused unless its base is the hash of the body it replaces;
// its comments posted and resolved, a reply to a reply refused, and a
// mention read by its person's name, erased once their name is; a
// reaction folded on and off, and refused off the six or where its
// circle has reactions off. Run by `cella test slice task`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { baseOf, createDoc, edits, thread } from '@cella/org-body/models'
import { comments } from '../src/drivers/comment.ts'

const db = new pg.Client()
const sacha = 'sacha@folded.example'
const commitment = { $commit: 'ab'.repeat(32) }

const one = async <R>(sql: string, values: unknown[] = []) => (await db.query(sql, values)).rows[0] as R
const fold = (fn: string, n: number, op: string, date: string, payload: unknown) =>
  db.query(`SELECT task.${fn}($1)`, [{ n, op, actor: sacha, date, cause: null, payload }])
const task = () =>
  one(`SELECT title, status, priority, to_char(due, 'YYYY-MM-DD') AS due, to_char(created, 'YYYY-MM-DD') AS created, to_char(completed, 'YYYY-MM-DD') AS completed FROM task.task WHERE id = 't-9001'`)

before(async () => {
  await db.connect()
  await db.query('BEGIN')
})

after(async () => {
  await db.query('ROLLBACK')
  await db.end()
})

test('a task folds created, moved, completed and reopened', async () => {
  await fold('fold_create', 1, 'task:task:create', '2041-01-15', { task: 't-9001', created: '2041-01-15', title: commitment, priority: 'high', due: '2041-02-01', status: 'todo' })
  assert.deepEqual(await task(), { title: 'redacted', status: 'todo', priority: 'high', due: '2041-02-01', created: '2041-01-15', completed: null })
  assert.equal((await one<{ n: string }>(`SELECT count(*) AS n FROM cella.commitment WHERE field = 'task.task.title' AND subject = 't-9001'`)).n, '1')
  await fold('fold_move', 2, 'task:task:move', '2041-01-16', { task: 't-9001', status: 'doing', completed: null })
  await fold('fold_complete', 3, 'task:task:complete', '2041-01-17', { task: 't-9001', status: 'done', completed: '2041-01-17' })
  await fold('fold_complete', 4, 'task:task:complete', '2041-01-18', { task: 't-9001', status: 'done', completed: '2041-01-17' })
  assert.deepEqual(await task(), { title: 'redacted', status: 'done', priority: 'high', due: '2041-02-01', created: '2041-01-15', completed: '2041-01-17' })
  await fold('fold_move', 5, 'task:task:move', '2041-01-19', { task: 't-9001', status: 'todo', completed: null })
  assert.deepEqual(await task(), { title: 'redacted', status: 'todo', priority: 'high', due: '2041-02-01', created: '2041-01-15', completed: null })
})

test('a task folds its priority and its due day changed, and a due day cleared', async () => {
  await fold('fold_create', 20, 'task:task:create', '2041-02-01', { task: 't-9010', created: '2041-02-01', title: commitment, priority: 'normal', due: '2041-03-01', status: 'todo' })
  const row = () => one(`SELECT priority, to_char(due, 'YYYY-MM-DD') AS due FROM task.task WHERE id = 't-9010'`)
  await fold('fold_set', 21, 'task:task:set', '2041-02-02', { task: 't-9010', priority: 'urgent' })
  assert.deepEqual(await row(), { priority: 'urgent', due: '2041-03-01' })
  await fold('fold_set', 22, 'task:task:set', '2041-02-03', { task: 't-9010', due: '2041-04-01' })
  assert.deepEqual(await row(), { priority: 'urgent', due: '2041-04-01' })
  await fold('fold_set', 23, 'task:task:set', '2041-02-04', { task: 't-9010', due: null })
  assert.deepEqual(await row(), { priority: 'urgent', due: null })
})

test('a body folds saved as the snapshot its entry carries, and a later save replaces it', async () => {
  const body = (text: string) => {
    const doc = createDoc(7n)
    edits.paste(doc, undefined, 0, [{ type: 'paragraph', runs: [{ text }], children: [] }])
    doc.commit()
    return doc.export({ mode: 'snapshot' })
  }
  const hex = (b: Uint8Array) => Buffer.from(b).toString('hex')
  await fold('fold_create', 6, 'task:task:create', '2041-01-20', { task: 't-9002', created: '2041-01-20', title: commitment, priority: 'normal', due: null, status: 'todo' })
  const first = body('Check the payment provider’s sandbox')
  await fold('fold_body_save', 7, 'task:body:save', '2041-01-20', { task: 't-9002', circle: 'ag', snapshot: hex(first), contributors: [sacha] })
  const saved = async () => (await one<{ body: Buffer; text: string }>(`SELECT body, cella.document_text(body) AS text FROM task.task WHERE id = 't-9002'`))
  assert.equal(hex((await saved()).body), hex(first))
  assert.match((await saved()).text, /payment provider’s sandbox/)
  const second = body('Go live on Monday')
  await fold('fold_body_save', 8, 'task:body:save', '2041-01-21', { task: 't-9002', circle: 'ag', snapshot: hex(second), contributors: [] })
  assert.equal(hex((await saved()).body), hex(second))
})

test('a body’s save is refused unless its base is the hash of the body it replaces, which the browser computes as Postgres does', async () => {
  const { body, hash } = await one<{ body: Buffer; hash: string }>(`SELECT body, encode(sha256(body), 'hex') AS hash FROM task.task WHERE id = 't-9002'`)
  assert.equal(baseOf(new Uint8Array(body)), hash)
  const based = async (payload: unknown) => (await one<{ reason: string | null }>('SELECT task.based($1) AS reason', [payload])).reason
  assert.equal(await based({ task: 't-9002', base: '', replaced: '' }), null)
  assert.equal(await based({ task: 't-9002', base: hash, replaced: hash }), null)
  assert.equal(
    await based({ task: 't-9002', base: '', replaced: hash }),
    `a body's save merged the body hashed none, but the task held the one hashed ${hash}; merging the saved body into the snapshot and saving again would allow it`,
  )
  assert.match((await based({ task: 't-9002', base: 'ab'.repeat(32), replaced: '' })) ?? '', /merged the body hashed (ab){32}, but the task held the one hashed none;/)
})

test('a body with no canonical form is refused by its column', async () => {
  await db.query('SAVEPOINT bad')
  await assert.rejects(db.query(`UPDATE task.task SET body = '\\x00ff'::bytea WHERE id = 't-9002'`))
  await db.query('ROLLBACK TO SAVEPOINT bad')
})

test('a save naming a contributor who holds no discuss in the task’s circle is refused, and says who', async () => {
  const guard = async (contributors: string[]) =>
    (await one<{ why: string | null }>(`SELECT task.contributed($1) AS why`, [{ task: 't-9002', circle: 'ag', snapshot: '', contributors }])).why
  assert.equal(await guard([]), null)
  assert.match((await guard([sacha])) ?? '', /holds no discuss in ag: sacha@folded\.example; a mandate granting it there/)
})

test('a comment folds posted under its receipt with its mentions; a reply reopens its root, and a resolve resolves or reopens it', async () => {
  await db.query(`INSERT INTO person.person (circle, address, name) VALUES (circle.assembly(), $1, 'Sacha Folded'), (circle.assembly(), 'noor@folded.example', 'Noor Folded')`, [sacha])
  await fold('fold_create', 9, 'task:task:create', '2041-01-22', { task: 't-9003', created: '2041-01-22', title: commitment, priority: 'normal', due: null, status: 'todo' })
  const root = { task: 't-9003', circle: 'ag', comment: 9010, parent: null, text: 'Ready for @[noor@folded.example]?', mentions: ['noor@folded.example'] }
  await fold('fold_comment_post', 10, 'task:comment:post', '2041-01-22', root)
  const comment = (id: number) =>
    one<{ author: string; parent: string | null; text: string; posted: string; resolved: string | null }>(
      `SELECT author, parent, text, to_char(posted, 'YYYY-MM-DD') AS posted, to_char(resolved, 'YYYY-MM-DD') AS resolved FROM task.comment WHERE id = $1`,
      [id],
    )
  assert.deepEqual(await comment(9010), { author: sacha, parent: null, text: root.text, posted: '2041-01-22', resolved: null })
  assert.deepEqual((await db.query(`SELECT n, person FROM task.mention WHERE comment = 9010`)).rows, [{ n: 1, person: 'noor@folded.example' }])
  await fold('fold_comment_resolve', 11, 'task:comment:resolve', '2041-01-23', { comment: 9010, task: 't-9003', circle: 'ag', resolved: true })
  assert.equal((await comment(9010)).resolved, '2041-01-23')
  await fold('fold_comment_post', 12, 'task:comment:post', '2041-01-24', { task: 't-9003', circle: 'ag', comment: 9012, parent: 9010, text: 'One more thing', mentions: [] })
  assert.deepEqual(await comment(9012), { author: sacha, parent: '9010', text: 'One more thing', posted: '2041-01-24', resolved: null })
  assert.equal((await comment(9010)).resolved, null, 'a reply reopens its root')
  await fold('fold_comment_resolve', 13, 'task:comment:resolve', '2041-01-25', { comment: 9010, task: 't-9003', circle: 'ag', resolved: true })
  await fold('fold_comment_resolve', 14, 'task:comment:resolve', '2041-01-26', { comment: 9010, task: 't-9003', circle: 'ag', resolved: false })
  assert.equal((await comment(9010)).resolved, null, 'a later reopen wins')
})

test('a reply to a reply, resolving a reply and a mention of no one are refused, each saying what would do', async () => {
  const posts = async (payload: unknown) => (await one<{ why: string | null }>(`SELECT task.posts($1) AS why`, [payload])).why
  const resolves = async (payload: unknown) => (await one<{ why: string | null }>(`SELECT task.resolves($1) AS why`, [payload])).why
  await db.query(`INSERT INTO task.comment (id, task, author, parent, text, posted) VALUES (9020, 't-9003', $1, 9012, 'A reply to a reply', '2041-01-27')`, [sacha])
  assert.equal(await posts({ task: 't-9003', comment: 9020, parent: 9012, text: 'A reply to a reply', mentions: [] }), 'comment 9012 is a reply: reply to its root, comment 9010')
  assert.equal(await resolves({ comment: 9012, resolved: true }), 'comment 9012 is a reply: resolve its root, comment 9010')
  assert.equal(await resolves({ comment: 9010, resolved: true }), null)
  assert.equal(await posts({ task: 't-9003', comment: 9030 }), 'no comment 9030')
  await db.query(`INSERT INTO task.comment (id, task, author, parent, text, posted) VALUES (9031, 't-9003', $1, NULL, 'For @[nobody@folded.example]', '2041-01-27')`, [sacha])
  assert.match(
    (await posts({ task: 't-9003', comment: 9031, parent: null, text: 'For @[nobody@folded.example]', mentions: ['nobody@folded.example'] })) ?? '',
    /^@\[nobody@folded\.example\] names no one the co-op knows/,
  )
})

test('a comment reads its mentions by the person’s name as it stands, and as erased once their name is', async () => {
  const read = async () => (await comments(db, 't-9003')).find((c) => c.id === 9010)?.mentions
  assert.deepEqual(await read(), [{ person: 'noor@folded.example', name: 'Noor Folded' }])
  await db.query(`SELECT cella.redact('noor@folded.example', 'profile')`)
  const erased = await read()
  assert.deepEqual(erased, [{ person: 'noor@folded.example', name: 'redacted' }])
  assert.equal(thread.label(erased?.[0], 'noor@folded.example'), 'erased')
})

test('a reaction folds on and off as its entry says, once per comment, person and emoji', async () => {
  const given = async () => (await db.query(`SELECT person, emoji FROM task.reaction WHERE comment = 9010 ORDER BY emoji`)).rows
  await fold('fold_comment_react', 15, 'task:comment:react', '2041-01-27', { comment: 9010, task: 't-9003', circle: 'ag', emoji: '👍', on: true })
  await fold('fold_comment_react', 16, 'task:comment:react', '2041-01-27', { comment: 9010, task: 't-9003', circle: 'ag', emoji: '👍', on: true })
  assert.deepEqual(await given(), [{ person: sacha, emoji: '👍' }])
  await fold('fold_comment_react', 17, 'task:comment:react', '2041-01-28', { comment: 9010, task: 't-9003', circle: 'ag', emoji: '👍', on: false })
  assert.deepEqual(await given(), [])
})

test('a reaction not of the six, or where the circle has reactions off, is refused, naming the circle and the rule', async () => {
  const reacts = async (payload: unknown) => (await one<{ why: string | null }>(`SELECT task.reacts($1) AS why`, [payload])).why
  assert.equal(await reacts({ comment: 9010, emoji: '👍', on: false }), null)
  assert.equal(await reacts({ comment: 9010, emoji: '💩', on: true }), '💩 is no reaction: react with one of 👍 ❤️ 😄 🎉 👀 🙏')
  const { a } = await one<{ a: string }>('SELECT circle.assembly() AS a')
  await db.query(`INSERT INTO circle.setting_value (policy, circle, setting, value, "from") VALUES ('m-2041-001/1', $1, 'reactions', 'off', '2000-01-01')`, [a])
  assert.equal(
    await reacts({ comment: 9010, emoji: '👍', on: false }),
    `reactions are off in ${a}, by rule m-2041-001/1: a rule turning them on, adopted by motion, lets a comment take them`,
  )
})
