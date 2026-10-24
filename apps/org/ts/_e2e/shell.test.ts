// The shell, end to end on a seeded Lanterne: its built server renders
// every main page, and its form actions make one write of each kind, as a
// browser posts them, signed by the acting member's fixture device. Run by
// `cella test`, which builds the shell first, on a fresh database.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn, type ChildProcess } from 'node:child_process'
import { createServer } from 'node:net'
import pg from 'pg'
import { parse } from 'devalue'
import * as drag from '@cella/org-ui/models'

const su = new pg.Client()
const entry = new URL('../build/index.js', import.meta.url).pathname

let server: ChildProcess | undefined
let base = ''

const ines = 'ines@lanterne.example'
const hugo = 'hugo@lanterne.example'
const camille = 'camille@lanterne.example'
const julien = 'julien@lanterne.example'

const free = () =>
  new Promise<number>((resolve) => {
    const s = createServer()
    s.listen(0, '127.0.0.1', () => {
      const port = (s.address() as { port: number }).port
      s.close(() => resolve(port))
    })
  })

// Starts the built server, in dev mode or not, after setting the notary's
// date for the app role, which each new connection picks up.
async function start(date: string, dev = true) {
  await stop()
  await su.query(`ALTER ROLE cella_app IN DATABASE ${su.escapeIdentifier(su.database ?? '')} SET cella.clock = '${date}'`)
  const port = await free()
  base = `http://127.0.0.1:${port}`
  // adapter-node takes the origin to be https unless a proxy's header says
  // otherwise; the test speaks plain http, as a proxy in front would say.
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PORT: String(port),
    HOST: '127.0.0.1',
    PROTOCOL_HEADER: 'x-forwarded-proto',
    CELLA_DEV: dev ? '1' : '',
  }
  delete env.DATABASE_URL
  server = spawn(process.execPath, [entry], { env, stdio: ['ignore', 'pipe', 'inherit'] })
  for (let i = 0; i < 100; i++) {
    try {
      await fetch(`${base}/search`)
      return
    } catch {
      await new Promise((r) => setTimeout(r, 100))
    }
  }
  throw new Error('the shell did not start')
}

async function stop() {
  if (server && server.exitCode === null) {
    const exited = new Promise((r) => server?.once('exit', r))
    // A graceful stop waits out fetch's kept-alive connections; the test
    // server holds nothing to finish.
    server.kill('SIGKILL')
    await exited
  }
  server = undefined
}

const page = async (path: string) => {
  const res = await fetch(`${base}${path}`)
  return { status: res.status, text: await res.text() }
}

interface Done {
  op: string
  state: string
  entry?: number
  reason?: string
  then: Done[]
}

// Posts a page's named action as an enhanced form does, acting as `actor`.
async function act(path: string, action: string, fields: Record<string, string | string[]>, actor?: string): Promise<Done> {
  const body = new URLSearchParams()
  for (const [k, v] of Object.entries(fields)) {
    for (const x of [v].flat()) {
      body.append(k, x)
    }
  }
  const res = await fetch(`${base}${path}?/${action}`, {
    method: 'POST',
    body,
    headers: {
      origin: base,
      'x-forwarded-proto': 'http',
      'x-sveltekit-action': 'true',
      ...(actor ? { cookie: `cella-act=${actor}` } : {}),
    },
  })
  const result = await res.json()
  assert.ok(result.data, `${path}?/${action}: ${JSON.stringify(result)}`)
  return parse(result.data).done
}

const one = async <R>(sql: string, values: unknown[] = []) => (await su.query(sql, values)).rows[0] as R

before(async () => {
  await su.connect()
  await start('2026-10-24')
})

after(async () => {
  await stop()
  await su.end()
})

test('every main page renders on the seed', async () => {
  const pages: [string, string][] = [
    ['/members', 'Camille Martin'],
    [`/members/${camille}`, 'Powers held'],
    ['/circles', 'Assemblée générale'],
    ['/circles/ag', 'Gérante'],
    ['/decisions', 'Admit Inès Haddad'],
    ['/decisions/d-2026-012', 'passes by consent'],
    ['/documents', 'Rate card 2027'],
    ['/documents/internal-rules', 'Règlement intérieur'],
    ['/invoices', 'F-2026-0055'],
    ['/invoices/F-2026-0044', 'Compagnie Mauve Horizon'],
    ['/clients', 'Vélo Solidaire'],
    ['/accounts', 'Banque'],
    ['/accounts/512', 'Ledger'],
    ['/periods', '2026-10'],
    ['/transactions', 'je-0001'],
    ['/transactions/je-0001', 'Opening balances'],
    ['/journal/je-0001', 'Opening balances'],
    ['/devices', 'laptop'],
    ['/log', 'verifies'],
  ]
  for (const [path, says] of pages) {
    const { status, text } = await page(path)
    assert.equal(status, 200, path)
    assert.ok(text.includes(says), `${path} says ${says}`)
  }
  assert.equal((await page('/nowhere')).status, 404)
  assert.equal((await page('/decisions/d-1999-001')).status, 404)
})

test('the sidebar names the co-op as the database does, and its menus open in the top layer', async () => {
  const { text } = await page('/members')
  assert.ok(text.includes('<title>Lanterne · cella</title>'), 'the co-op is called by its name')
  assert.ok(text.includes('Lanterne SCOP SARL'), 'its menu gives its legal name')
  assert.ok(!text.includes('lanterne.example</b>'), 'not by its address')
  assert.equal((text.match(/popover="auto"/g) ?? []).length, 2, 'the co-op menu and the account menu are popovers')
})

test('every collection has a dashboard, its widgets run by the server', async () => {
  const invoices = await page('/invoices?view=dashboard')
  assert.equal(invoices.status, 200)
  for (const says of ['Owed', 'Overdue', 'Amounts by month', 'By standing', '€']) {
    assert.ok(invoices.text.includes(says), `the invoices' dashboard says ${says}`)
  }
  const members = await page('/members?view=dashboard')
  assert.equal(members.status, 200)
  assert.ok(members.text.includes('By status'), 'the members\' dashboard is derived from their fields')
  const own = encodeURIComponent(JSON.stringify([{ kind: 'kpi', title: 'Active members', measure: { op: 'count' }, where: [{ field: 'status', is: ['active'] }] }]))
  const configured = await page(`/members?view=dashboard&w=${own}`)
  assert.ok(configured.text.includes('Active members'), 'a viewer\'s widgets in the address are run')
  const bad = encodeURIComponent(JSON.stringify([{ kind: 'kpi', title: 'x', measure: { op: 'sum', field: 'name; DROP TABLE member' } }]))
  const refused = await page(`/members?view=dashboard&w=${bad}`)
  assert.equal(refused.status, 200)
  assert.ok(refused.text.includes('names no field of the collection'), 'an undeclared field is refused, and said')
})

test('widgets reordered as the keyboard drops them stay in their new order', async () => {
  const ws = [
    { kind: 'kpi', title: 'Owed', measure: { op: 'sum', field: 'owed' } },
    { kind: 'kpi', title: 'Overdue', measure: { op: 'sum', field: 'owed' }, where: [{ field: 'state', is: ['overdue'] }] },
    { kind: 'chart', title: 'By standing', measure: { op: 'count' }, by: 'state' },
  ]
  // Lifting the first, two steps down and a drop: what the View card hands
  // the address.
  const move = drag.drop(drag.step(drag.step(drag.start('widgets', 0, ws.length, 'keyboard'), 1), 1)).move
  assert.ok(move)
  const moved = drag.reorder(ws, move.from, move.to)
  const { text } = await page(`/invoices?view=dashboard&w=${encodeURIComponent(JSON.stringify(moved))}`)
  const at = (title: string) => text.indexOf(`>${title}<`)
  assert.ok(at('Overdue') > 0 && at('Overdue') < at('By standing') && at('By standing') < at('Owed'), 'the dashboard renders in the dropped order')
})

test('circles open as a gallery and decisions as a board, by what each declares', async () => {
  const circles = await page('/circles')
  assert.match(circles.text, /class="gallery[\s"]/, 'circles default to the gallery')
  assert.ok(circles.text.includes('Seated'), 'a circle\'s card shows its seats')
  const decisions = await page('/decisions')
  assert.match(decisions.text, /class="board[\s"]/, 'decisions default to the board')
  for (const lane of ['open', 'passed', 'rejected']) {
    assert.ok(decisions.text.includes(`data-drop-list="${lane}"`), `the board has its ${lane} column`)
  }
  assert.match((await page('/decisions?view=list')).text, /class="list[\s"]/, 'a view in the address overrides the default')
})

test('a decision is open, passed or rejected, as the database reads it', async () => {
  const { text } = await page('/decisions?view=table')
  assert.ok(text.includes('>passed<'), 'a closed decision that carried reads passed')
  assert.ok(!/closed and|>closed</.test(text), 'no screen says closed for a decision\'s state')
  assert.match((await page('/decisions')).text, /title="View Passed decisions \d+"/)
  assert.ok((await page('/decisions/d-2026-012')).text.includes('>open<'))
})

test('the stance form starts at the acting member\'s latest stance, and is not offered off the roll', async () => {
  const as = async (path: string, actor?: string) =>
    (await fetch(`${base}${path}`, { headers: actor ? { cookie: `cella-act=${actor}` } : {} })).text()
  const hugos = await as('/decisions/d-2026-012', hugo)
  assert.match(hugos, /<option value="consent"[^>]*selected/, 'Hugo\'s select holds his latest stance, consent')
  assert.ok(hugos.includes('Change stance'), 'and offers to change it')
  assert.ok(hugos.includes('Now: consent · receipt 33'), 'saying which receipt it is')
  assert.ok((await as('/decisions/d-2026-012')).includes('Act as a member to give a stance.'))
})

test('a card dropped on a closed column is the close write; refused before the deadline, it stays open', async () => {
  const shifts = [{ by: 'state', from: ['open'], to: ['passed', 'rejected'], action: 'close' }]
  assert.equal(drag.shift(shifts, 'state', 'open', 'rejected')?.action, 'close')
  assert.equal(drag.shift(shifts, 'state', 'passed', 'open'), undefined, 'no write reopens a decision, so no drop does')
  assert.equal(drag.shift(shifts, 'state', 'open', 'open'), undefined)
  assert.equal(drag.shift(shifts, 'circle', 'open', 'passed'), undefined, 'a move is a write only on the board it is declared for')
  const lane = (html: string, name: string) => html.split(`data-drop-list="${name}"`)[1]?.split('data-drop-list=')[0] ?? ''
  assert.ok(lane((await page('/decisions')).text, 'open').includes('Admit Inès Haddad'))
  const done = await act('/decisions/d-2026-012', 'close', {}, hugo)
  assert.notEqual(done.state, 'settled', 'the close is refused before its deadline')
  assert.ok(done.reason, 'and says why')
  assert.ok(lane((await page('/decisions')).text, 'open').includes('Admit Inès Haddad'), 'the card snaps back to open')
})

test('a collection\'s preset views are tabs with their counts, and a view in the address applies its filter', async () => {
  const { text } = await page('/invoices')
  for (const tab of ['View Unpaid invoices', 'View Overdue invoices', 'View All invoices']) {
    assert.match(text, new RegExp(`title="${tab} \\d+"`), `the invoices show the ${tab} tab with its count`)
  }
  const all = Number(text.match(/title="View All invoices (\d+)"/)?.[1])
  const overdue = Number(text.match(/title="View Overdue invoices (\d+)"/)?.[1])
  assert.ok(overdue > 0 && overdue < all, `${overdue} of ${all} invoices are overdue`)
  const links = (html: string) => new Set(html.match(/href="\/invoices\/F-[\d-]+"/g))
  assert.equal(links(text).size, all)
  const filtered = await page('/invoices?v=overdue')
  assert.equal(links(filtered.text).size, overdue, 'the overdue view lists only the overdue invoices')
  const custom = encodeURIComponent(JSON.stringify([{ field: 'state', is: ['paid'] }]))
  const paid = await page(`/invoices?v=c-mine&where=${custom}`)
  assert.ok(links(paid.text).size > 0 && links(paid.text).size < all, 'a saved view\'s conditions in the address filter the rows')
})

test('a write with no one acting fails before any verdict', async () => {
  const done = await act('/decisions/d-2026-012', 'vote', { stance: 'object' })
  assert.equal(done.state, 'failed')
  assert.match(done.reason ?? '', /act as a member first/)
})

test('Hugo edits the internal rules from a text area: one Loro update, settled', async () => {
  const { text } = await page('/documents/internal-rules')
  assert.ok(text.includes('Tuesday is a studio day'))
  const draft = (await one<{ body: string }>(`SELECT body FROM document.version WHERE id = 'internal-rules@3'`)).body
  const edited = await act('/documents/internal-rules', 'edit', { text: draft.replace('Tuesday', 'Thursday').replaceAll('\n', '\r\n') }, hugo)
  assert.deepEqual(edited, { op: 'document:document:edit', state: 'settled', entry: 1, then: [] })
  assert.ok((await page('/documents/internal-rules')).text.includes('Thursday is a studio day'))
  const same = await act('/documents/internal-rules', 'edit', { text: draft.replace('Tuesday', 'Thursday') }, hugo)
  assert.equal(same.state, 'failed', 'an edit that changes nothing is not sent')
})

test('Julien issues F-2026-0056, posted to the books; Camille, without the power, is refused', async () => {
  const fields = {
    series: 'F-2026',
    bill_to: 'Vélo Solidaire',
    label: 'Workshop on accessibility',
    description: ['Workshop', 'Materials'],
    quantity: ['2', '1'],
    unit_price: ['450', '120,50'],
    vat_rate: ['20', '20'],
  }
  const refused = await act('/invoices', 'issue', fields, camille)
  assert.equal(refused.state, 'refused')
  assert.match(refused.reason ?? '', /holds no mandate for issue-invoice/)
  const issued = await act('/invoices', 'issue', fields, julien)
  assert.deepEqual(issued, { op: 'invoice:invoice:issue', state: 'settled', entry: 2, then: [] })
  const made = await one<{ total: string; entry: string }>(
    `SELECT cella.cents(i.total) AS total, p.entry FROM invoice.invoice i JOIN invoice_transaction.posting p ON p.invoice = i.id WHERE i.id = 'F-2026-0056'`,
  )
  assert.deepEqual(made, { total: '122460', entry: 'je-0041' })
  const { text } = await page('/invoices/F-2026-0056')
  assert.ok(text.includes('Workshop on accessibility') && text.includes('je-0041'))
  const linked = await act('/invoices/F-2026-0056', 'link', { client: 'velo' }, julien)
  assert.equal(linked.state, 'settled')
})

test('Hugo objects to admitting Inès, then consents; closing early is refused', async () => {
  const objected = await act('/decisions/d-2026-012', 'vote', { stance: 'object' }, hugo)
  assert.equal(objected.state, 'settled')
  assert.ok((await page('/decisions/d-2026-012')).text.includes('does not pass by consent'))
  const consented = await act('/decisions/d-2026-012', 'vote', { stance: 'consent' }, hugo)
  assert.equal(consented.state, 'settled')
  const early = await act('/decisions/d-2026-012', 'close', {}, camille)
  assert.equal(early.state, 'refused')
  assert.match(early.reason ?? '', /open until 2026-10-31/)
})

test('closed on 31 October, d-2026-012 admits Inès and seats her, as the close\'s reactions', async () => {
  await start('2026-10-31')
  const closed = await act('/decisions/d-2026-012', 'close', {}, camille)
  assert.equal(closed.state, 'settled')
  assert.deepEqual(
    closed.then.map((d) => [d.op, d.state]),
    [
      ['member:member:admit', 'settled'],
      ['circle-member:position:add', 'settled'],
    ],
  )
  const { text } = await page(`/members/${ines}`)
  assert.ok(text.includes('active') && text.includes('Assemblée générale'))
  assert.ok((await page('/decisions/d-2026-012')).text.includes('passed by consent'))
})

test('outside dev mode the server signs for no one', async () => {
  await start('2026-10-31', false)
  const done = await act('/decisions/d-2026-011', 'vote', { stance: 'consent' }, camille)
  assert.equal(done.state, 'failed')
  assert.match(done.reason ?? '', /signs for no one/)
})

test('the log the shell wrote verifies, and its page says so', async () => {
  assert.equal((await one<{ v: boolean }>('SELECT cella.verify_log() AS v')).v, true)
  const { text } = await page('/log')
  assert.ok(text.includes('verifies') && text.includes('decision:decision:close'))
})
