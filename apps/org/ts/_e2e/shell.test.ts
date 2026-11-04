// The shell, end to end on a seeded Lanterne: its built server renders
// every main page, and its form actions make one write of each kind, as a
// browser posts them, each signed by the signed-in member's own device,
// their fixture device held by the test as their browser holds it. Run
// by `cella test`, which builds the shell first, on a fresh database.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import * as drag from '@cella/org-ui/models'
import { b64, createDoc, order, text as text_ } from '@cella/org-document/models'
import { Shell, type Done } from './serve.ts'

const su = new pg.Client()
const shell = new Shell(su)

const ines = 'ines@lanterne.example'
const hugo = 'hugo@lanterne.example'
const camille = 'camille@lanterne.example'
const julien = 'julien@lanterne.example'

const start = (date: string) => shell.start(date)

// A page as a member reads it, Camille unless named.
const page = (path: string, actor = camille) => shell.page(path, actor)

// Posts a page's named action as a form does, signed in as `actor`.
const act = (path: string, action: string, fields: Record<string, string | string[]>, actor: string) => shell.act(path, action, fields, actor)

const one = async <R>(sql: string, values: unknown[] = []) => (await su.query(sql, values)).rows[0] as R

before(async () => {
  await su.connect()
  await start('2026-10-24')
})

after(async () => {
  await shell.stop()
  await su.end()
})

test('every main page renders on the seed', async () => {
  const pages: [string, string][] = [
    ['/people', 'Camille Martin'],
    [`/people/${camille}`, 'Powers held'],
    ['/circles', 'Assemblée générale'],
    ['/circles/ag', 'Gérante'],
    ['/motions', 'Admit Inès Haddad'],
    ['/motions/m-2026-012', 'passes by consent'],
    ['/documents', 'Rate card 2027'],
    ['/documents/internal-rules', 'Règlement intérieur'],
    ['/invoices', 'F-2026-0055'],
    ['/invoices/F-2026-0044', 'Compagnie Mauve Horizon'],
    ['/bills', 'Imprimerie du Parc'],
    ['/bills/bi-0002', 'Studio rent, October'],
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
  assert.equal((await page('/motions/m-1999-001')).status, 404)
})

test('the sidebar names the co-op as the database does, and its menus open in the top layer', async () => {
  const { text } = await page('/people')
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
  const people = await page('/people?view=dashboard')
  assert.equal(people.status, 200)
  assert.ok(people.text.includes('By member'), 'the people\'s dashboard is derived from their fields, the membership\'s among them')
  const own = encodeURIComponent(JSON.stringify([{ kind: 'kpi', title: 'Active members', measure: { op: 'count' }, where: [{ field: 'member', is: ['member'] }] }]))
  const configured = await page(`/people?view=dashboard&w=${own}`)
  assert.ok(configured.text.includes('Active members'), 'a viewer\'s widgets in the address are run')
  const bad = encodeURIComponent(JSON.stringify([{ kind: 'kpi', title: 'x', measure: { op: 'sum', field: 'name; DROP TABLE member' } }]))
  const refused = await page(`/people?view=dashboard&w=${bad}`)
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

test('circles open as a gallery and motions as a board, by what each declares', async () => {
  const circles = await page('/circles')
  assert.match(circles.text, /class="gallery[\s"]/, 'circles default to the gallery')
  assert.ok(circles.text.includes('Seated'), 'a circle\'s card shows its seats')
  const motions = await page('/motions')
  assert.match(motions.text, /class="board[\s"]/, 'motions default to the board')
  for (const lane of ['open', 'passed', 'rejected']) {
    assert.ok(motions.text.includes(`data-drop-list="${lane}"`), `the board has its ${lane} column`)
  }
  assert.match((await page('/motions?view=list')).text, /class="list[\s"]/, 'a view in the address overrides the default')
})

test('a motion is open, passed or rejected, as the database reads it', async () => {
  const { text } = await page('/motions?view=table')
  assert.ok(text.includes('>passed<'), 'a closed motion that carried reads passed')
  assert.ok(!/closed and|>closed</.test(text), 'no screen says closed for a motion\'s state')
  assert.ok((await page('/motions/m-2026-012')).text.includes('>open<'))
})

test('the stance form starts at the acting member\'s latest stance, and is not offered off the roll', async () => {
  const as = async (path: string, actor: string) => (await page(path, actor)).text
  const hugos = await as('/motions/m-2026-012?tab=stances', hugo)
  assert.match(hugos, /<option value="consent"[^>]*selected/, 'Hugo\'s select holds his latest stance, consent')
  assert.ok(hugos.includes('Change stance'), 'and offers to change it')
  assert.ok(hugos.includes('Now: consent · receipt 34'), 'saying which receipt it is')
  assert.ok((await as('/motions/m-2026-012?tab=stances', ines)).includes("Not on this motion's roll."), 'Inès, invited, reads the assembly\'s motion as every seat does, and is on no roll')
})

test('a motion\'s overview says what is decided in full; its stances are their own tab', async () => {
  const overview = await page('/motions/m-2026-012')
  for (const says of ['Overview', 'Stances', 'Proposal', 'admits', 'Inès Haddad', 'passes by consent', 'Deadline 31 Oct 2026']) {
    assert.ok(overview.text.includes(says), `the overview says ${says}`)
  }
  assert.ok(!overview.text.includes('Latest stance'), 'the roll is not on the overview')
  const stances = await page('/motions/m-2026-012?tab=stances')
  assert.ok(stances.text.includes('Latest stance') && !stances.text.includes('>Proposal<'), 'the stances tab holds the roll alone')
})

test('a card dropped on a closed column is the close write; refused before the deadline, it stays open', async () => {
  const shifts = [{ by: 'state', from: ['open'], to: ['passed', 'rejected'], action: 'close' }]
  assert.equal(drag.shift(shifts, 'state', 'open', 'rejected')?.action, 'close')
  assert.equal(drag.shift(shifts, 'state', 'passed', 'open'), undefined, 'no write reopens a motion, so no drop does')
  assert.equal(drag.shift(shifts, 'state', 'open', 'open'), undefined)
  assert.equal(drag.shift(shifts, 'circle', 'open', 'passed'), undefined, 'a move is a write only on the board it is declared for')
  const lane = (html: string, name: string) => html.split(`data-drop-list="${name}"`)[1]?.split('data-drop-list=')[0] ?? ''
  assert.ok(lane((await page('/motions')).text, 'open').includes('Admit Inès Haddad'))
  const done = await act('/motions/m-2026-012', 'close', {}, hugo)
  assert.notEqual(done.state, 'settled', 'the close is refused before its deadline')
  assert.ok(done.reason, 'and says why')
  assert.ok(lane((await page('/motions')).text, 'open').includes('Admit Inès Haddad'), 'the card snaps back to open')
})

test('a collection leads with its All tab and its count, and a view in the address applies its filter', async () => {
  const { text } = await page('/invoices')
  const all = Number(text.match(/title="View All invoices (\d+)"/)?.[1])
  assert.ok(all > 0, 'the invoices show the All tab with its count')
  assert.equal((text.match(/title="View /g) ?? []).length, 1, 'no preset repeats what the list and its filters show')
  const links = (html: string) => new Set(html.match(/href="\/invoices\/F-[\d-]+"/g))
  assert.equal(links(text).size, all)
  const overdue = encodeURIComponent(JSON.stringify([{ field: 'state', is: ['overdue'] }]))
  const filtered = await page(`/invoices?where=${overdue}`)
  assert.ok(links(filtered.text).size > 0 && links(filtered.text).size < all, 'a condition in the address lists only the rows it keeps')
  const custom = encodeURIComponent(JSON.stringify([{ field: 'state', is: ['paid'] }]))
  const paid = await page(`/invoices?v=c-mine&where=${custom}`)
  assert.ok(links(paid.text).size > 0 && links(paid.text).size < all, 'a saved view\'s conditions in the address filter the rows')
})

test('with no session, a page goes to the sign-in and a write is refused before any verdict', async () => {
  const receipts = async () => (await one<{ n: number }>('SELECT count(*)::int AS n FROM cella.receipt')).n
  const before = await receipts()
  const unsigned = await shell.page('/motions/m-2026-012')
  assert.equal(unsigned.status, 303)
  assert.equal(unsigned.location, '/sign-in?back=%2Fmotions%2Fm-2026-012')
  assert.equal((await shell.page('/sign-in')).status, 200, 'the sign-in page is reached with no session')
  const posted = await shell.post('/motions/m-2026-012', 'vote', new URLSearchParams({ stance: 'object' }))
  assert.equal(posted.status, 401)
  const forged = `cella-session=${Buffer.from(hugo).toString('base64url')}.${'ab'.repeat(32)}.9999999999999.${'00'.repeat(32)}`
  assert.equal((await shell.post('/motions/m-2026-012', 'vote', new URLSearchParams({ stance: 'object' }), forged)).status, 401, 'a cookie the server did not MAC opens no session')
  assert.equal(await receipts(), before, 'no receipt was taken')
})

test('Hugo edits the internal rules as the editor does: one Loro update, settled and relayed live', async () => {
  const { text } = await page('/documents/internal-rules')
  assert.ok(text.includes('Tuesday is a studio day'))

  // A second member has the document open: its stream opens with what it
  // lacks, then relays each edit as it settles.
  const live = await fetch(`${shell.base}/documents/internal-rules/live`, { headers: { cookie: await shell.signIn(camille) } })
  assert.equal(live.headers.get('content-type'), 'text/event-stream')
  const reader = live.body!.pipeThrough(new TextDecoderStream()).getReader()
  const events: string[] = []
  const next = async () => {
    let buffer = ''
    while (!buffer.includes('\n\n') || !buffer.includes('event: update')) {
      const { value, done } = await reader.read()
      assert.ok(!done, 'the stream ended')
      buffer += value
    }
    events.push(buffer)
  }
  await next()

  const doc = createDoc(77n)
  const rows = (await su.query<{ bytes: Buffer }>(`SELECT bytes FROM document.update WHERE document = 'internal-rules' ORDER BY receipt`)).rows
  doc.importBatch(rows.map((r) => new Uint8Array(r.bytes)))
  const from = doc.version()
  const id = order(doc).find((r) => text_(doc, r.id).toString().includes('Tuesday'))?.id
  assert.ok(id)
  const t = text_(doc, id)
  const at = t.toString().indexOf('Tuesday')
  t.delete(at, 7)
  t.insert(at, 'Thursday')
  doc.commit()
  const update = b64.encode(doc.export({ mode: 'update', from }))
  const edited = await act('/documents/internal-rules', 'edit', { update }, hugo)
  assert.deepEqual(edited, { op: 'document:document:edit', state: 'settled', entry: 2, then: [] })
  await next()
  assert.ok(events[1].includes(`"update":"${update}"`), 'the edit is relayed as it was sent')
  await reader.cancel()

  assert.ok((await page('/documents/internal-rules')).text.includes('Thursday is a studio day'))
  const junk = await act('/documents/internal-rules', 'edit', { update: 'AAAA' }, hugo)
  assert.equal(junk.state, 'failed', 'bytes that are not a Loro update are not written')
})

test('Julien issues F-2026-0056, posted to the books, and its PDF opens from its page; Camille, without the power, is refused', async () => {
  const fields = {
    series: 'F-2026',
    bill_to: 'Vélo Solidaire',
    bill_address: '42 rue de Romainville\n93100 Montreuil',
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
  assert.deepEqual(issued, { op: 'invoice:invoice:issue', state: 'settled', entry: 3, then: [] })
  const made = await one<{ total: string; entry: string }>(
    `SELECT cella.cents(i.total) AS total, p.entry FROM invoice.invoice i JOIN invoice_transaction.posting p ON p.invoice = i.id WHERE i.id = 'F-2026-0056'`,
  )
  assert.deepEqual(made, { total: '122460', entry: 'je-0041' })
  const { text } = await page('/invoices/F-2026-0056')
  assert.ok(text.includes('Workshop on accessibility') && text.includes('je-0041'))
  assert.ok(text.includes('Download PDF'), 'the page offers the invoice as a PDF')
  const printed = await page('/invoices/F-2026-0056/content')
  assert.equal(printed.status, 200)
  assert.equal(printed.type, 'application/pdf')
  for (const mention of ['%PDF-1.4', '(N', ' F-2026-0056)', '(42 rue de Romainville)', '(93100 Montreuil)', 'RCS Bobigny', 'L441-10']) {
    assert.ok(printed.text.includes(mention), `the PDF prints ${mention}`)
  }
  const linked = await act('/invoices/F-2026-0056', 'link', { client: 'velo' }, julien)
  assert.equal(linked.state, 'settled')
})

test('Hugo objects to admitting Inès, then consents; closing early is refused', async () => {
  const objected = await act('/motions/m-2026-012', 'vote', { stance: 'object' }, hugo)
  assert.equal(objected.state, 'settled')
  assert.ok((await page('/motions/m-2026-012')).text.includes('does not pass by consent'))
  const consented = await act('/motions/m-2026-012', 'vote', { stance: 'consent' }, hugo)
  assert.equal(consented.state, 'settled')
  const early = await act('/motions/m-2026-012', 'close', {}, camille)
  assert.equal(early.state, 'refused')
  assert.match(early.reason ?? '', /open until 2026-10-31/)
})

test('closed on 31 October, m-2026-012 admits Inès and seats her in the close\'s own verdict, and her subscription follows it; she signs with the phone she took up her invitation on', async () => {
  await start('2026-10-31')
  const closed = await act('/motions/m-2026-012', 'close', {}, camille)
  assert.equal(closed.state, 'settled')
  const outline = (ds: Done[]): unknown[] => ds.map((d) => [d.op, d.state, outline(d.then)])
  assert.deepEqual(
    outline(closed.then),
    [['membership:member:admit', 'settled', [['account:capital:subscribe', 'settled', []]]]],
    'the admission is the close, and the subscription a write of its own after it',
  )
  assert.ok(!JSON.stringify(closed).includes('"request"'), 'what a reaction asked stays on the server')
  const subscribed = await one<{ op: string; actor: string }>('SELECT op, actor FROM cella.log WHERE n = $1', [closed.then[0].then[0].entry])
  assert.deepEqual(subscribed, { op: 'account:capital:subscribe', actor: camille })
  const { text } = await page(`/people/${ines}`)
  assert.ok(text.includes('active') && text.includes('Assemblée générale') && text.includes('phone'))
  assert.ok((await page('/motions/m-2026-012')).text.includes('passed by consent'))
})

test('the log the shell wrote verifies, and its page says so', async () => {
  assert.equal((await one<{ v: boolean }>('SELECT cella.verify_log() AS v')).v, true)
  const { text } = await page('/log')
  assert.ok(text.includes('verifies') && text.includes('motion:motion:close'))
})
