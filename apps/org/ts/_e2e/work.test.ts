// The work scenario, end to end on a seeded Lanterne through the built
// shell: the work pages render; Thomas creates a task, Yusuf gives it to
// him and files it under the Halles shop, and Thomas moves it across the
// board and completes it; he logs time against the shop and his week from
// the form, each naming Web, the circle it was worked for, submits Web's
// October, and once the month is over Yusuf, Web's lead, approves it,
// which closes it to new entries and leaves no root month open; Yusuf may not approve his own month; no share or budget
// goes beyond the pot; and a lead budgets their own circle's projects
// alone, by their mandates' scope. Run by `cella test`, which builds the shell first,
// on a fresh database.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { weeks } from '@cella/org-graft-employment-project-timesheet/api'
import { Shell } from './serve.ts'

const su = new pg.Client()
const shell = new Shell(su)

const thomas = 'thomas@lanterne.example'
const yusuf = 'yusuf@lanterne.example'
const hugo = 'hugo@lanterne.example'
const ines = 'ines@lanterne.example'

const one = async <R>(sql: string, values: unknown[] = []) => (await su.query(sql, values)).rows[0] as R
const lane = (html: string, name: string) => html.split(`data-drop-list="${name}"`)[1]?.split('data-drop-list=')[0] ?? ''

let task = ''

before(async () => {
  await su.connect()
  await shell.start('2026-10-24')
})

after(async () => {
  await shell.stop()
  await su.end()
})

test('the seed holds Lanterne\'s work: its projects, tasks and two months of time', async () => {
  const counts = await one<{ projects: string; tasks: string; entries: string; approved: string }>(
    `SELECT (SELECT count(*) FROM project.project) AS projects, (SELECT count(*) FROM task.task) AS tasks,
            (SELECT count(*) FROM timesheet.entry) AS entries,
            (SELECT count(*) FROM timesheet.period WHERE month = '2026-09' AND approved IS NOT NULL) AS approved`,
  )
  assert.deepEqual(counts, { projects: '11', tasks: '37', entries: '848', approved: '11' })
  const days = await one<{ off: string }>(
    `SELECT count(*) AS off FROM (SELECT member, day FROM timesheet.entry GROUP BY member, day HAVING sum(minutes) <> 420) d`,
  )
  assert.equal(days.off, '0', 'every worker logs seven hours a working day')
})

test('the work pages render, each collection in its own layout', async () => {
  const pages: [string, string][] = [
    ['/projects', 'Les Halles Paysannes, online shop'],
    ['/projects/halles-shop?tab=milestones', 'Care and handover'],
    ['/projects/halles-shop?tab=tasks', 'Fix VAT display on mixed baskets'],
    ['/projects/halles-shop?tab=time', 'Spent of the budget'],
    ['/tasks', 'Press check at the printer'],
    ['/tasks/t-6', 'Fix VAT display on mixed baskets'],
    ['/timesheets', 'Shop: VAT fixes'],
    ['/timesheets?view=dashboard', 'Hours by project'],
    [`/people/${yusuf}?tab=employment`, 'Timesheets'],
    ['/contacts/halles?tab=projects', 'Les Halles Paysannes, online shop'],
    ['/invoices/F-2026-0054', 'Les Halles Paysannes, online shop'],
  ]
  for (const [path, says] of pages) {
    const { status, text } = await shell.page(path, thomas)
    assert.equal(status, 200, path)
    assert.ok(text.includes(says), `${path} says ${says}`)
  }
  // An invoice is the circle's whose project it bills: F-2026-0052 is
  // Brand's, so Inès, in Web and no member, reads none of it and finds no
  // page, while Thomas, a member, reads it by open books.
  const brands = await shell.page('/invoices/F-2026-0052', ines)
  assert.equal(brands.status, 404, 'a Brand invoice is none to Inès')
  assert.ok(!brands.text.includes('Maison Ferrand, packaging'), 'a Brand project\'s title is none to Inès')
  assert.ok((await shell.page('/invoices/F-2026-0052', thomas)).text.includes('Maison Ferrand, packaging'), 'Thomas reads it by open books')
  assert.ok((await shell.page('/invoices/F-2026-0052', hugo)).text.includes('Maison Ferrand, packaging'), 'and Brand\'s lead reads it')
  const time = await shell.page('/timesheets', thomas)
  assert.ok(!time.text.includes('Books, invoicing, payroll and contracts'), 'Thomas reads his own time, not Julien\'s')
  const projects = await shell.page('/projects', thomas)
  assert.match(projects.text, /class="gallery[\s"]/, 'projects open as a gallery')
  assert.ok(projects.text.includes('Les Halles Paysannes') && projects.text.includes('3 / 4'), 'a card names its contact and its milestones')
  const tasks = await shell.page('/tasks', thomas)
  assert.match(tasks.text, /class="board[\s"]/, 'tasks open as a board')
  for (const l of ['backlog', 'todo', 'doing', 'done']) {
    assert.ok(tasks.text.includes(`data-drop-list="${l}"`), `the board has its ${l} column`)
  }
  assert.match((await shell.page('/timesheets', thomas)).text, /class="table[\s"]|<table/, 'timesheets open as a table')
  const dashboard = await shell.page('/timesheets?view=dashboard', thomas)
  for (const says of ['Hours by worker', 'Hours by project', 'Billable hours', 'Thomas Nguyen', 'Les Halles Paysannes, online shop']) {
    assert.ok(dashboard.text.includes(says), `the timesheets' dashboard says ${says}`)
  }
  const tabs = await shell.page('/projects/halles-shop', thomas)
  for (const tab of ['Overview', 'Milestones', 'Budget', 'Tasks', 'Time', 'Expenses', 'Invoices']) {
    assert.ok(tabs.text.includes(`>${tab}<`), `a project's page has its ${tab} tab`)
  }
  assert.ok(!tabs.text.includes('href="/invoices/F-2026-0054"'),'its overview leaves its invoices to their tab')
  const invoiced = await shell.page('/projects/halles-shop?tab=invoices', thomas)
  assert.ok(/>Net<\/dt>.*?36\s000,00\s€/s.test(invoiced.text) && invoiced.text.includes('F-2026-0054'), 'its Invoices tab lists what it invoiced, the net as a figure')
})

test('Thomas creates a task; Yusuf gives it to him and files it under the shop\'s care', async () => {
  const created = await shell.act('/tasks', 'create', { title: 'Audit the checkout for RGAA', priority: 'high', due: '2026-10-30' }, thomas)
  assert.equal(created.state, 'settled', created.reason)
  task = (await one<{ id: string }>(`SELECT id FROM task.task WHERE title = 'Audit the checkout for RGAA'`)).id
  assert.equal(task, 't-38', 'numbered on from the seed')
  const assigned = await shell.act(`/tasks/${task}`, 'assign', { member: thomas }, yusuf)
  assert.equal(assigned.state, 'settled', assigned.reason)
  const filed = await shell.act(`/tasks/${task}`, 'file', { place: 'halles-shop#4' }, yusuf)
  assert.equal(filed.state, 'settled', filed.reason)
  const away = await shell.act(`/tasks/${task}`, 'assign', { member: 'ines@lanterne.example' }, yusuf)
  assert.equal(away.state, 'refused')
  assert.match(away.reason ?? '', /ines@lanterne.example is no active member/)
  assert.ok(lane((await shell.page('/tasks', thomas)).text, 'todo').includes('Audit the checkout for RGAA'), 'it waits in To do')
})

test('Thomas drags it into Doing, then Done, each drop a write signed as him', async () => {
  // What the board posts on a drop: the write its column names, with the
  // column entered.
  const doing = await shell.act(`/tasks/${task}`, 'move', { to: 'doing' }, thomas)
  assert.deepEqual([doing.op, doing.state], ['task:task:move', 'settled'])
  assert.ok(lane((await shell.page('/tasks', thomas)).text, 'doing').includes('Audit the checkout for RGAA'))
  const done = await shell.act(`/tasks/${task}`, 'complete', { to: 'done' }, thomas)
  assert.deepEqual([done.op, done.state], ['task:task:complete', 'settled'])
  assert.deepEqual(await one(`SELECT status, to_char(completed, 'YYYY-MM-DD') AS completed FROM task.task WHERE id = $1`, [task]), {
    status: 'done',
    completed: '2026-10-24',
  })
  const into = await shell.act(`/tasks/${task}`, 'move', { to: 'done' }, thomas)
  assert.equal(into.state, 'failed', 'done is a completion, not a move')
})

// The options a select of the page's offers, in order, by its name.
const offered = (html: string, name: string) =>
  [...(html.split(`name="${name}"`)[1]?.split('</select>')[0] ?? '').matchAll(/<option value="([^"]*)"/g)].map((m) => m[1])

test('Thomas logs time against the shop for Web, its circle, which the page offers him first', async () => {
  const { text } = await shell.page('/projects/halles-shop?tab=time', thomas)
  assert.deepEqual(offered(text, 'circle'), ['web', 'ag'], 'the shop is Web\'s, offered before the assembly he also sits in')
  const logged = await shell.act('/projects/halles-shop', 'log', { day: '2026-10-24', hours: '2,5', billable: 'billable', circle: 'web', note: 'Checkout audit' }, thomas)
  assert.equal(logged.state, 'settled', logged.reason)
  const booked = await one<{ project: string; circle: string }>(
    `SELECT b.project, e.circle FROM project_timesheet.booking b JOIN timesheet.entry e ON e.id = b.entry WHERE e.note = 'Checkout audit'`,
  )
  assert.deepEqual(booked, { project: 'halles-shop', circle: 'web' })
})

test('Thomas logs his week from the form, each row naming the circle its time is worked for, and both rows land in Web\'s October', async () => {
  // The week names each row's circle: the shop's offers Web first, the
  // co-op's own time the root's, and he chooses Web for it, the time he
  // gave Web's own meeting. The week is read as the server reads it for
  // him, through the app's connection as its actor.
  const app = new pg.Client({ user: 'cella_app' })
  await app.connect()
  await app.query(`SELECT set_config('cella.actor', $1, false)`, [thomas])
  const [now] = await weeks(app, thomas)
  await app.end()
  assert.equal(now.monday, '2026-10-19')
  const circles = (project: string) => now.rows.find((r) => r.project === project)?.circles.map((c) => c.id)
  assert.deepEqual(circles('halles-shop'), ['web', 'ag'])
  assert.deepEqual(circles(''), ['ag', 'web'])
  const week: [string, string][] = [
    ['row', 'halles-shop'],
    ['row', '_'],
    ['day', '2026-10-24'],
    ['circle.halles-shop', 'web'],
    ['circle._', 'web'],
    ['cell.halles-shop.2026-10-24', '1'],
    ['cell._.2026-10-24', '0,5'],
  ]
  const logged = await shell.act('/timesheets', 'week', week, thomas)
  assert.equal(logged.state, 'settled', logged.reason)
  const entries = await su.query(
    `SELECT e.circle, e.minutes, b.project FROM timesheet.entry e LEFT JOIN project_timesheet.booking b ON b.entry = e.id
     WHERE e.member = $1 AND e.day = '2026-10-24' ORDER BY e.minutes`,
    [thomas],
  )
  assert.deepEqual(entries.rows, [
    { circle: 'web', minutes: 30, project: null },
    { circle: 'web', minutes: 60, project: 'halles-shop' },
    { circle: 'web', minutes: 150, project: 'halles-shop' },
  ])
})

test('Thomas submits October; Yusuf cannot approve it before the month ends', async () => {
  const ahead = await shell.act('/timesheets', 'log', { day: '2026-10-26', hours: '7', billable: 'billable' }, thomas)
  assert.equal(ahead.state, 'refused')
  assert.match(ahead.reason ?? '', /an entry for 2026-10-26 is in the future/)
  const submitted = await shell.act(`/people/${thomas}`, 'submit', { month: '2026-10/web' }, thomas)
  assert.equal(submitted.state, 'settled', submitted.reason)
  const forOther = await shell.act(`/people/${yusuf}`, 'submit', { month: '2026-10/web' }, thomas)
  assert.equal(forOther.state, 'refused')
  assert.match(forOther.reason ?? '', /thomas@lanterne.example may not submit yusuf@lanterne.example's time/)
  const early = await shell.act(`/people/${thomas}`, 'approve', { month: '2026-10/web' }, yusuf)
  assert.equal(early.state, 'refused')
  assert.match(early.reason ?? '', /2026-10 runs until 2026-10-31/)
})

test('in November Yusuf, Web\'s lead, approves Thomas\'s October for Web, all of his time, with no root month left open beside it; his own he may not approve', async () => {
  await shell.start('2026-11-02')
  const approved = await shell.act(`/people/${thomas}`, 'approve', { month: '2026-10/web' }, yusuf)
  assert.deepEqual([approved.op, approved.state], ['timesheet:period:approve', 'settled'])
  // Every hour he logged from the shell named Web, so Web's month is all
  // of his October, and approving it closes it to the week form too.
  const months = await su.query(`SELECT circle, state FROM timesheet.sheet WHERE member = $1 AND month = '2026-10' ORDER BY circle`, [thomas])
  assert.deepEqual(months.rows, [{ circle: 'web', state: 'approved' }])
  const late = await shell.act(
    '/timesheets',
    'week',
    [
      ['row', 'halles-shop'],
      ['day', '2026-10-30'],
      ['circle.halles-shop', 'web'],
      ['cell.halles-shop.2026-10-30', '1'],
    ],
    thomas,
  )
  assert.equal(late.state, 'refused')
  assert.match(late.reason ?? '', /2026-10 in web was approved on 2026-11-02/)
  const november = await shell.act('/timesheets', 'log', { day: '2026-11-02', hours: '7', billable: 'billable' }, thomas)
  assert.equal(november.state, 'settled', 'November is open')
  const own = await shell.act(`/people/${yusuf}`, 'submit', { month: '2026-10/web' }, yusuf)
  assert.equal(own.state, 'settled', own.reason)
  const self = await shell.act(`/people/${yusuf}`, 'approve', { month: '2026-10/web' }, yusuf)
  assert.equal(self.state, 'refused')
  assert.match(self.reason ?? '', /yusuf@lanterne.example may not approve their own time/)
  const { text } = await shell.page(`/people/${thomas}?tab=employment`, thomas)
  assert.ok(text.includes('Yusuf Demir'), 'his page names who approved his month')
})

test('no share goes beyond what is left of the budget, and no budget falls below its shares', async () => {
  const beyond = await shell.act('/projects/ferrand-packaging', 'share', { member: 'sofia@lanterne.example', amount: '13000' }, hugo)
  assert.equal(beyond.state, 'refused')
  assert.match(beyond.reason ?? '', /exceeds what is left of ferrand-packaging's budget, 1200000 of 1400000 cents/)
  const within = await shell.act('/projects/ferrand-packaging', 'share', { member: 'sofia@lanterne.example', amount: '600' }, hugo)
  assert.equal(within.state, 'settled', within.reason)
  const below = await shell.act('/projects/ferrand-packaging', 'budget', { amount: '2000' }, hugo)
  assert.equal(below.state, 'refused')
  assert.match(below.reason ?? '', /ferrand-packaging's shares come to 260000 cents, more than a budget of 200000/)
  const raised = await shell.act('/projects/ferrand-packaging', 'budget', { amount: '15000' }, hugo)
  assert.deepEqual([raised.op, raised.state], ['project:project:budget', 'settled'])
  const capped = await shell.act('/projects/halles-shop', 'budget', { amount: '60000' }, yusuf)
  assert.equal(capped.state, 'refused', 'a lead sets budgets up to 15 000 €')
  assert.match(capped.reason ?? '', /holds no mandate for set-budget up to/)
})

test('a lead\'s mandates cover their own circle\'s projects: Yusuf, Web\'s lead, budgets Web\'s and is refused Brand\'s', async () => {
  const own = await shell.act('/projects/clairval-site', 'budget', { amount: '14000' }, yusuf)
  assert.deepEqual([own.op, own.state], ['project:project:budget', 'settled'], own.reason)
  const brand = await shell.act('/projects/velo-identity', 'budget', { amount: '3400' }, yusuf)
  assert.equal(brand.state, 'refused')
  assert.match(brand.reason ?? '', /holds set-budget by no mandate covering brand's records/)
  // His mandates mark their scope; the manager's mark none and cover the whole co-op.
  const scopes = await one<{ lead: string[]; manager: string[] }>(
    `SELECT array_agg(DISTINCT coalesce(scope, '—')) FILTER (WHERE grantee = 'lead' AND power IN ('manage-project', 'set-budget')) AS lead,
            array_agg(DISTINCT coalesce(scope, '—')) FILTER (WHERE grantee = 'manager' AND power IN ('manage-project', 'set-budget')) AS manager
     FROM circle.mandate`,
  )
  assert.deepEqual(scopes, { lead: ['own'], manager: ['—'] })
})

test('the log the work wrote verifies', async () => {
  assert.equal((await one<{ v: boolean }>('SELECT cella.verify_log() AS v')).v, true)
})
