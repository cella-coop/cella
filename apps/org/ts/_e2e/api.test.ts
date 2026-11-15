// Every command over HTTP, end to end on a seeded Lanterne through the
// built shell, as a client with no page posts it: signed in by its
// device's answer to the session's challenge, each command posted as JSON
// to `POST /api/<feat>/<verb>`, answered 202 with what to sign, and the
// proof posted back to the same address until the outcome comes. Thomas
// creates a task, a confluent command; Yusuf budgets his circle's project,
// an ordered one, which settles at once at rung 1, and is refused
// another circle's, with the guard's reason. What is no command, no JSON,
// no session, or a permission several forms serve with none named, is
// refused before anything runs. Every collection and item is read over
// HTTP as JSON at `GET /api/<collection>` and `/api/<collection>/<id>`:
// Chloé and Yusuf, of two circles, each read their own payslips alone,
// and the other's is a 404; the query string takes the page's address's
// layout and filter. Run by `cella test e2e api`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { Shell } from './serve.ts'

const su = new pg.Client()
const shell = new Shell(su)

const thomas = 'thomas@lanterne.example'
const yusuf = 'yusuf@lanterne.example'
const chloe = 'chloe@lanterne.example'

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

  for (const body of [JSON.stringify({ form: 'tasks.create', fields: null }), JSON.stringify({ run: 'none', proof: null }), '{"form": "tasks.create", "fields": {']) {
    const malformed = await raw('/api/task/create', body, json)
    assert.equal(malformed.status, 400, `${body} is refused 400, never a 500`)
  }

  const gone = await raw('/api/task/create', JSON.stringify({ run: 'none', proof: { device: 'a', salt: 'b', nonce: 'c', sig: 'd' } }), json)
  assert.equal(gone.status, 409, 'a proof for a run that is not the poster’s')

  const anyone = await raw('/api/task/create', JSON.stringify({ form: 'tasks.create', fields: { title: 'x' } }), { 'content-type': 'application/json' })
  assert.equal(anyone.status, 401, 'no session, no command')
  const count = await one<{ n: number }>(`SELECT count(*)::int AS n FROM task.task WHERE title = 'x'`)
  assert.equal(count.n, 0, 'none of them wrote')
})

// A read over HTTP, signed in as `actor`, or with no session: the status
// and the JSON it answers.
const get = async (path: string, actor?: string) => {
  const headers: Record<string, string> = { accept: 'application/json', ...(actor ? { cookie: await shell.signIn(actor) } : {}) }
  const res = await fetch(`${shell.base}${path}`, { headers })
  return { status: res.status, body: (await res.json()) as Record<string, unknown> }
}

test('Chloé and Yusuf, of Marketing and Web, each read the payslips collection and an item over HTTP, their own rows only, and the other’s is a 404', async () => {
  const ids = (body: Record<string, unknown>) => (body.rows as { id: string }[]).map((r) => r.id)
  for (const [actor, other] of [[chloe, yusuf], [yusuf, chloe]] as const) {
    const listed = await get('/api/payslips', actor)
    assert.equal(listed.status, 200, `${actor}: ${JSON.stringify(listed.body)}`)
    assert.ok(ids(listed.body).includes(`2026-09~${actor}`), `${actor} reads their September payslip`)
    assert.ok(ids(listed.body).every((id) => id.endsWith(`~${actor}`)), `${actor} reads no one else’s: ${ids(listed.body)}`)
    assert.equal(listed.body.kept, ids(listed.body).length, 'and the count is of their rows alone')
    const own = await get(`/api/payslips/${encodeURIComponent(`2026-09~${actor}`)}`, actor)
    assert.equal(own.status, 200)
    assert.deepEqual([own.body.name, own.body.id], ['payslips', `2026-09~${actor}`], 'the item the page reads, as JSON')
    const theirs = await get(`/api/payslips/${encodeURIComponent(`2026-09~${other}`)}`, actor)
    assert.equal(theirs.status, 404, `${other}’s payslip is none to ${actor}`)
  }
})

test('a collection’s query string takes what its page’s address takes, and what is no collection, no session’s or too long is refused', async () => {
  const all = await get('/api/expenses', chloe)
  assert.equal(all.status, 200)
  const viewed = await get('/api/expenses?view=table', chloe)
  assert.equal(viewed.status, 200)
  assert.equal((viewed.body.spec as { layout: string }).layout, 'table', 'the layout the address names')
  assert.notEqual((all.body.spec as { layout: string }).layout, 'table', 'not the collection’s own')
  const filtered = await get('/api/expenses?q=ex-0003', chloe)
  assert.deepEqual((filtered.body.rows as { id: string }[]).map((r) => r.id), ['ex-0003'], 'the rows the text filter holds')
  const nowhere = await get('/api/nowhere', chloe)
  assert.equal(nowhere.status, 404)
  assert.match(String(nowhere.body.reason), /There is no collection nowhere/)
  assert.equal((await fetch(`${shell.base}/api/expenses`, { headers: { accept: 'application/json' } })).status, 401, 'no session, no read')
  const long = await get(`/api/expenses?q=${'x'.repeat(5000)}`, chloe)
  assert.equal(long.status, 400)
  assert.match(String(long.body.reason), /search is at most 4096 characters/)
})
