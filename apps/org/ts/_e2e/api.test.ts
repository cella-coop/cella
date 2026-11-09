// Every command over HTTP, end to end on a seeded Lanterne through the
// built shell, as a client with no page posts it: signed in by its
// device's answer to the session's challenge, each command posted as JSON
// to `POST /api/<feat>/<verb>`, answered 202 with what to sign, and the
// proof posted back to the same address until the outcome comes. Thomas
// creates a task, a confluent command; Yusuf budgets his circle's project,
// an ordered one, which settles at once at rung 1, and is refused
// another circle's, with the guard's reason. What is no command, no JSON,
// no session, or a permission several forms serve with none named, is
// refused before anything runs. Run by `cella test e2e api`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { Shell } from './serve.ts'

const su = new pg.Client()
const shell = new Shell(su)

const thomas = 'thomas@lanterne.example'
const yusuf = 'yusuf@lanterne.example'

const one = async <R>(sql: string, values: unknown[] = []) => (await su.query(sql, values)).rows[0] as R

// A post with no session's cookie, or with one, as raw as a client sends it.
const raw = (path: string, body: string, headers: Record<string, string>) =>
  fetch(`${shell.base}${path}`, { method: 'POST', body, headers })

before(async () => {
  await su.connect()
  await shell.start('2026-10-24')
})

after(async () => {
  await shell.stop()
  await su.end()
})

test('Thomas creates a task over HTTP: asked for one signature, 202, then settled, 200, and logged under its permission', async () => {
  const before = await one<{ n: number }>('SELECT count(*)::int AS n FROM cella.log')
  const created = await shell.api('task', 'create', { form: 'tasks.create', fields: { title: 'Read the API over curl', priority: 'high' } }, thomas)
  assert.deepEqual(created.asked, [202], 'the post that starts it asks for the device’s signature')
  assert.deepEqual([created.status, created.done.op, created.done.state], [200, 'task:task:create', 'settled'], created.done.reason)
  const logged = await one<{ op: string; n: number }>('SELECT l.op, (SELECT count(*)::int FROM cella.log) AS n FROM cella.log l ORDER BY l.n DESC LIMIT 1')
  assert.deepEqual([logged.op, logged.n], ['task:task:create', before.n + 1], 'one entry, the command’s')
  const made = await one<{ title: string }>(`SELECT title FROM task.task WHERE title = 'Read the API over curl'`)
  assert.ok(made, 'the task is made')
})

test('Yusuf budgets Web’s project over HTTP, an ordered command that settles at once, and is refused Brand’s with the guard’s reason, 422', async () => {
  const own = await shell.api('project', 'budget', { id: 'clairval-site', fields: { amount: '14000' } }, yusuf)
  assert.deepEqual(own.asked, [202])
  assert.deepEqual([own.status, own.done.op, own.done.state], [200, 'project:project:budget', 'settled'], own.done.reason)
  const brand = await shell.api('project', 'budget', { id: 'velo-identity', fields: { amount: '3400' } }, yusuf)
  assert.deepEqual([brand.status, brand.done.state], [422, 'refused'])
  assert.match(brand.done.reason ?? '', /holds set-budget by no mandate covering brand's records/)
})

test('what is no command, no JSON, no session’s or names no form is refused before anything runs', async () => {
  const cookie = await shell.signIn(thomas)
  const json = { 'content-type': 'application/json', cookie }
  const nothing = await raw('/api/task/fly', '{}', json)
  assert.equal(nothing.status, 404)
  assert.match(((await nothing.json()) as { done: { reason: string } }).done.reason, /no command is served at \/api\/task\/fly/)

  const form = await raw('/api/task/create', 'title=x', { 'content-type': 'application/x-www-form-urlencoded', cookie, origin: shell.base, 'x-forwarded-proto': 'http' })
  assert.equal(form.status, 415, 'a form’s post is no command')

  const unnamed = await raw('/api/task/create', JSON.stringify({ fields: { title: 'x' } }), json)
  assert.equal(unnamed.status, 400)
  assert.match(((await unnamed.json()) as { done: { reason: string } }).done.reason, /task:task:create is served by more than one form: name one as form, .*tasks\.create/)

  const odd = await raw('/api/task/create', JSON.stringify({ form: 'tasks.create', fields: { title: 7 } }), json)
  assert.equal(odd.status, 400)
  assert.match(((await odd.json()) as { done: { reason: string } }).done.reason, /title is a text or a list of texts/)

  const gone = await raw('/api/task/create', JSON.stringify({ run: 'none', proof: { device: 'a', salt: 'b', nonce: 'c', sig: 'd' } }), json)
  assert.equal(gone.status, 409, 'a proof for a run that is not the poster’s')

  const anyone = await raw('/api/task/create', JSON.stringify({ form: 'tasks.create', fields: { title: 'x' } }), { 'content-type': 'application/json' })
  assert.equal(anyone.status, 401, 'no session, no command')
  const count = await one<{ n: number }>(`SELECT count(*)::int AS n FROM task.task WHERE title = 'x'`)
  assert.equal(count.n, 0, 'none of them wrote')
})
