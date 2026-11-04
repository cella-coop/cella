// The meetings scenario, end to end on a seeded Lanterne through the
// built shell: Lanterne's meetings render, on a calendar and each with
// its agenda, who came and its minutes; Camille schedules coordination
// for 2 November, which Yusuf, Web's lead, may not; its members draw up
// its agenda, reorder it and table the rate card, which Thomas, seated
// elsewhere, may not; members mark themselves, Malik as secretary
// records the others and may not record Thomas, who comes as a guest;
// Malik holds it on its day, which fixes the agenda and who came, and
// begins the minutes, a document opening on the meeting's card, which he
// writes in the block editor. Run by `cella test e2e meetings`, on the
// built shell; `SHOTS` names where its screenshots go.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import pg from 'pg'
import { chromium, type Browser } from 'playwright-core'
import { browsers, serve, signIn } from './browser.ts'
import { Shell } from './serve.ts'

const su = new pg.Client()
const shell = new Shell(su)
const shots = process.env.SHOTS ?? '/tmp/cella-meeting-shots'

const at = (name: string) => `${name}@lanterne.example`
const camille = at('camille')
const malik = at('malik')
const yusuf = at('yusuf')
const hugo = at('hugo')
const julien = at('julien')
const thomas = at('thomas')
const meeting = 'coordination-2026-11-02'
const minutes = `minutes-${meeting}`

const all = async <R>(sql: string, values: unknown[] = []) => (await su.query(sql, values)).rows as R[]
const one = async <R>(sql: string, values: unknown[] = []) => (await all<R>(sql, values))[0]
const agenda = async () => (await all<{ title: string }>('SELECT title FROM meeting.item WHERE meeting = $1 ORDER BY pos, id', [meeting])).map((r) => r.title)
const item = async (title: string) => (await one<{ id: string }>('SELECT id::text AS id FROM meeting.item WHERE meeting = $1 AND title = $2', [meeting, title])).id

before(async () => {
  mkdirSync(shots, { recursive: true })
  await su.connect()
  await shell.start('2026-10-24')
})

after(async () => {
  await shell.stop()
  await su.end()
})

test('the seed holds Lanterne\'s meetings: the June assembly, coordination every Monday and the assembly to come', async () => {
  const counts = await one<Record<string, string>>(
    `SELECT (SELECT count(*) FROM meeting.meeting) AS meetings,
            (SELECT count(*) FROM meeting.meeting WHERE status = 'held') AS held,
            (SELECT count(*) FROM meeting_membership.attendance) AS marks,
            (SELECT count(*) FROM meeting_motion.tabled) AS tabled,
            (SELECT count(*) FROM document_meeting.minutes) AS minutes`,
  )
  assert.deepEqual(counts, { meetings: '10', held: '8', marks: '46', tabled: '7', minutes: '1' })
  const june = await one('SELECT seats, present, needed FROM meeting_membership.quorum WHERE meeting = $1', ['ag-2026-06-20'])
  assert.deepEqual(june, { seats: 10, present: 10, needed: 5 })
  const guests = await all<{ member: string }>('SELECT member FROM meeting_membership.roll WHERE NOT seated')
  assert.deepEqual(guests, [{ member: at('lea') }], 'Léa came to coordination as a guest')
})

test('the meeting pages render: a calendar of the month, an agenda with who came, and the minutes with their cards', async () => {
  const pages: [string, string[]][] = [
    ['/meetings', ['October 2026', 'Coordination', 'General assembly', 'class="calendar month']],
    ['/meetings?at=2026-06-01', ['June 2026', 'Annual general assembly']],
    ['/meetings?span=week&at=2026-10-26', ['26 Oct – 1 Nov 2026', 'General assembly']],
    ['/meetings?view=list', ['Annual general assembly']],
    ['/meetings/coordination-2026-10-19', ['The day rate: Malik', 'Motions tabled', 'm-2026-012', 'Attendance', '5 of 5, 3 needed']],
    ['/meetings/coordination-2026-09-21', ['Léa Bernard', 'guest']],
    ['/meetings/ag-2026-06-20?tab=minutes', ['61 400 €', 'Meeting · ag-2026-06-20', 'Motion · m-2026-006', 'Approve the 2025 accounts', 'Write in the editor']],
    ['/documents/minutes-ag-2026-06-20', ['Minutes, Annual general assembly', 'meeting, 20 Jun 2026']],
    ['/circles/coordination', ['Next meeting', 'Coordination']],
    ['/motions/m-2026-011', ['19 Oct 2026, held']],
  ]
  for (const [path, says] of pages) {
    const { status, text } = await shell.page(path, camille)
    assert.equal(status, 200, path)
    for (const s of says) {
      assert.ok(text.includes(s), `${path} says ${s}`)
    }
  }
  const page = await shell.page('/meetings/ag-2026-06-20', camille)
  for (const tab of ['Agenda', 'Minutes']) {
    assert.ok(page.text.includes(`>${tab}<`), `a meeting's page has its ${tab} tab`)
  }
})

test('Camille schedules coordination for 2 November; Yusuf, whose power reaches Web alone, may not', async () => {
  const fields = { circle: 'coordination', title: 'Coordination', day: '2026-11-02', time: '10:00', place: 'Studio', link: 'https://meet.lanterne.example/coordination' }
  const scheduled = await shell.act('/meetings', 'schedule', fields, camille)
  assert.deepEqual([scheduled.op, scheduled.state], ['meeting:meeting:schedule', 'settled'], scheduled.reason)
  assert.equal((await one<{ at: string }>(`SELECT to_char(at, 'YYYY-MM-DD HH24:MI') AS at FROM meeting.meeting WHERE id = $1`, [meeting])).at, '2026-11-02 10:00')
  const yusufs = await shell.act('/meetings', 'schedule', fields, yusuf)
  assert.equal(yusufs.state, 'refused')
  assert.match(yusufs.reason ?? '', /yusuf@lanterne.example holds schedule-meeting over no circle that holds coordination-2026-11-02/)
  const web = await shell.act('/meetings', 'schedule', { ...fields, circle: 'web', title: 'Web' }, yusuf)
  assert.equal(web.state, 'settled', web.reason)
  const nowhere = await shell.act('/meetings', 'schedule', { ...fields, circle: 'dreams' }, camille)
  assert.equal(nowhere.state, 'refused')
  assert.match(nowhere.reason ?? '', /no circle dreams to meet/)
})

test('its members draw up the agenda, reorder it and table the rate card; Thomas, seated elsewhere, may not', async () => {
  for (const [title, presenter, by] of [
    ['Pipeline', 'Camille', camille],
    ['Staffing for November', 'Yusuf', yusuf],
    ['The assembly, the day after', 'Malik', malik],
  ]) {
    const added = await shell.act(`/meetings/${meeting}`, 'item', { title, presenter, minutes: '15' }, by)
    assert.deepEqual([added.op, added.state], ['meeting:item:add', 'settled'], added.reason)
  }
  const outsider = await shell.act(`/meetings/${meeting}`, 'item', { title: 'Checkout audit', presenter: 'Thomas' }, thomas)
  assert.equal(outsider.state, 'refused')
  assert.match(outsider.reason ?? '', /thomas@lanterne.example holds no seat in coordination: its agenda is its members'/)
  // What the agenda's drop posts: the item, and the index it lands at.
  const moved = await shell.act(`/meetings/${meeting}`, 'move', { item: await item('The assembly, the day after'), to: '0' }, malik)
  assert.deepEqual([moved.op, moved.state], ['meeting:item:move', 'settled'], moved.reason)
  assert.deepEqual(await agenda(), ['The assembly, the day after', 'Pipeline', 'Staffing for November'])
  const down = await shell.act(`/meetings/${meeting}`, 'move', { item: await item('Pipeline'), to: '2' }, hugo)
  assert.equal(down.state, 'settled', down.reason)
  assert.deepEqual(await agenda(), ['The assembly, the day after', 'Staffing for November', 'Pipeline'])
  const tabled = await shell.act(`/meetings/${meeting}`, 'table', { motion: 'm-2026-011', title: '', presenter: 'Malik', minutes: '20' }, malik)
  assert.deepEqual([tabled.op, tabled.state], ['meeting:item:add', 'settled'], tabled.reason)
  assert.deepEqual(await agenda(), ['The assembly, the day after', 'Staffing for November', 'Pipeline', 'Raise the day rate for 2027'])
  const removed = await shell.act(`/meetings/${meeting}`, 'remove', { item: await item('Staffing for November') }, yusuf)
  assert.equal(removed.state, 'settled', removed.reason)
  const { text } = await shell.page(`/meetings/${meeting}`, malik)
  assert.ok(text.includes('Raise the day rate for 2027') && text.includes('open until'), 'the page says where the tabled motion stands')
})

test('members mark themselves; Malik, its secretary, records the others and may not record Thomas, who comes as a guest', async () => {
  for (const [who, status] of [
    [camille, 'present'],
    [hugo, 'excused'],
    [malik, 'present'],
  ]) {
    const marked = await shell.act(`/meetings/${meeting}`, 'attend', { status }, who)
    assert.deepEqual([marked.op, marked.state], ['meeting-membership:attendance:mark', 'settled'], marked.reason)
  }
  const recorded = await shell.act(`/meetings/${meeting}`, 'record', { member: yusuf, status: 'present' }, malik)
  assert.deepEqual([recorded.op, recorded.state], ['meeting-membership:attendance:record', 'settled'], recorded.reason)
  const outsider = await shell.act(`/meetings/${meeting}`, 'record', { member: thomas, status: 'present' }, malik)
  assert.equal(outsider.state, 'refused')
  assert.match(outsider.reason ?? '', /thomas@lanterne.example holds no seat in coordination on 2026-11-02: only they may mark themselves, as a guest/)
  const guest = await shell.act(`/meetings/${meeting}`, 'attend', { status: 'present' }, thomas)
  assert.equal(guest.state, 'settled', guest.reason)
  const camilles = await shell.act(`/meetings/${meeting}`, 'record', { member: julien, status: 'present' }, camille)
  assert.equal(camilles.state, 'refused')
  assert.match(camilles.reason ?? '', /camille@lanterne.example holds keep-minutes over no circle that holds coordination-2026-11-02/)
  const early = await shell.act(`/meetings/${meeting}`, 'hold', {}, malik)
  assert.equal(early.state, 'refused')
  assert.match(early.reason ?? '', /coordination-2026-11-02 meets on 2026-11-02: it is not held before/)
})

test('on 2 November Malik holds it, which fixes its agenda and who came', async () => {
  await shell.start('2026-11-02')
  const julienHere = await shell.act(`/meetings/${meeting}`, 'record', { member: julien, status: 'present' }, malik)
  assert.equal(julienHere.state, 'settled', julienHere.reason)
  const held = await shell.act(`/meetings/${meeting}`, 'hold', {}, malik)
  assert.deepEqual([held.op, held.state], ['meeting:meeting:hold', 'settled'], held.reason)
  assert.deepEqual(await one('SELECT seats, present, needed FROM meeting_membership.quorum WHERE meeting = $1', [meeting]), { seats: 5, present: 4, needed: 3 })
  const late = await shell.act(`/meetings/${meeting}`, 'item', { title: 'Any other business' }, camille)
  assert.equal(late.state, 'refused')
  assert.match(late.reason ?? '', /coordination-2026-11-02 was held on 2026-11-02: its agenda is fixed/)
  const lateMark = await shell.act(`/meetings/${meeting}`, 'attend', { status: 'present' }, hugo)
  assert.equal(lateMark.state, 'refused')
  assert.match(lateMark.reason ?? '', /who came is fixed/)
  const cancelled = await shell.act(`/meetings/${meeting}`, 'cancel', {}, camille)
  assert.equal(cancelled.state, 'refused')
  assert.match(cancelled.reason ?? '', /coordination-2026-11-02 was held on 2026-11-02/)
  const { text } = await shell.page(`/meetings/${meeting}`, malik)
  assert.ok(text.includes('4 of 5, 3 needed'), 'quorate: four of its five seats present, Thomas a guest')
})

test('Malik begins the minutes: a document opening on the meeting\'s card and its agenda', async () => {
  const begun = await shell.act(`/meetings/${meeting}`, 'minute', {}, malik)
  assert.deepEqual([begun.op, begun.state], ['meeting:meeting:minute', 'settled'], begun.reason)
  assert.deepEqual(await one('SELECT document FROM document_meeting.minutes WHERE meeting = $1', [meeting]), { document: minutes })
  assert.deepEqual(await one('SELECT count(*)::int AS n, min(author) AS author FROM document.update WHERE document = $1', [minutes]), { n: 1, author: malik })
  const again = await shell.act(`/meetings/${meeting}`, 'minute', {}, malik)
  assert.equal(again.state, 'settled', 'begun again, they are the same minutes')
  assert.equal(Number((await one<{ n: string }>('SELECT count(*) AS n FROM document.document WHERE id LIKE $1', [`${minutes}%`])).n), 1)
  const { text } = await shell.page(`/meetings/${meeting}?tab=minutes`, malik)
  for (const says of ['Minutes, Coordination', `Meeting · ${meeting}`, '1. The assembly, the day after', '3. Raise the day rate for 2027']) {
    assert.ok(text.includes(says), `the minutes say ${says}`)
  }
  const thomasBegins = await shell.act('/meetings/coordination-2026-10-26', 'minute', {}, thomas)
  assert.equal(thomasBegins.state, 'refused', 'Thomas keeps no minutes')
})

test('Malik writes them in the block editor, the meeting card drawn among the blocks; the pages are screenshotted', async () => {
  // Chromium alone: the editor's own scenario drives the three engines.
  browsers()
  const { base, stop } = await serve()
  let browser: Browser | undefined
  try {
    browser = await chromium.launch()
    const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, extraHTTPHeaders: { 'x-forwarded-proto': 'http' } })
    await signIn(context, base, malik)
    const page = await context.newPage()
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto(`${base}/documents/${minutes}`)
    await page.waitForSelector('[data-editor] [data-block]')
    await page.waitForSelector('[data-sync=live]')
    assert.ok(await page.locator('[data-editor]').getByText(`Meeting · ${meeting}`).isVisible(), 'the meeting card is drawn in the editor')
    // The empty paragraph under Present, the fourth block.
    await page.locator('[data-editor] .line').nth(3).locator('[contenteditable=true]').click()
    await page.keyboard.type('Camille, Yusuf, Malik and Julien; Hugo excused; Thomas as a guest.')
    for (let i = 0; i < 50 && (await page.locator('[data-state]').getAttribute('data-state')) !== 'saved'; i++) {
      await page.waitForTimeout(100)
    }
    assert.equal(await page.locator('[data-state]').getAttribute('data-state'), 'saved')
    await page.screenshot({ path: `${shots}/minutes-editor.png`, fullPage: true })
    assert.deepEqual(errors, [], 'the page threw nothing')

    const saved = await shell.act(`/documents/${minutes}`, 'version', {}, malik)
    assert.equal(saved.state, 'settled', saved.reason)
    const plain = await one<{ plain: string }>('SELECT plain FROM document.version WHERE document = $1', [minutes])
    assert.match(plain.plain, /Camille, Yusuf, Malik and Julien; Hugo excused; Thomas as a guest\./)

    await signIn(context, base, camille)
    for (const [name, path] of [
      ['meetings-calendar', '/meetings?at=2026-10-01'],
      ['meetings-week', '/meetings?span=week&at=2026-10-26'],
      ['meeting-agenda', `/meetings/${meeting}`],
      ['meeting-agenda-open', '/meetings/coordination-2026-10-26'],
      ['meeting-minutes', `/meetings/${meeting}?tab=minutes`],
      ['assembly-minutes', '/meetings/ag-2026-06-20?tab=minutes'],
    ]) {
      await page.goto(`${base}${path}`)
      await page.waitForLoadState('networkidle')
      await page.screenshot({ path: `${shots}/${name}.png`, fullPage: true })
    }
    assert.deepEqual(errors, [], 'the pages threw nothing')
  } finally {
    await browser?.close()
    await stop()
  }
})

test('the log the meetings wrote verifies', async () => {
  assert.equal((await one<{ v: boolean }>('SELECT cella.verify_log() AS v')).v, true)
})
