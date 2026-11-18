// The import scenario, end to end on a seeded Lanterne, with the sample
// files a co-op brings from the tools it leaves (fixtures/lanterne/import):
// Camille tries the members' list in a dry run from the Imports page,
// which invites no one, then imports it, inviting Nadia and Olivier with
// their devices and refusing Rose, who has none. Julien carries October
// over from the old books' FEC under his power to carry them over: the
// rental, paid from the bank before cella, opens the account it names;
// the fees entry does not balance and 2025's opening falls in no period, so
// both are refused, and the trial balance still holds. He issues the
// invoices the spreadsheet lists, numbered and posted. Inès brings her
// own time from Toggl and Harvest, and others' rows are refused. Camille
// brings contacts, projects and Asana's tasks, a contact held already and a
// task done before the switch left out. Every run is recorded with what
// each line came to, and `cella import` runs the same import from the
// command line. Run by `cella test e2e import`.
// covers: account account-transaction contact import invoice invoice-transaction membership project project-task project-timesheet task timesheet transaction

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import pg from 'pg'
import type { Deps } from '@cella/org-db'
import { imported } from '../src/lib/server/feats/import.ts'
import { reader, sign } from './lanterne.ts'
import { Shell } from './serve.ts'

const su = new pg.Client()
const shell = new Shell(su)
let app: pg.Client

const camille = 'camille@lanterne.example'
const julien = 'julien@lanterne.example'
const ines = 'ines@lanterne.example'

const dir = new URL('../../fixtures/lanterne/import/', import.meta.url)
const sample = (name: string) => new Uint8Array(readFileSync(new URL(name, dir)))
const as = (actor: string): Deps => ({ db: reader(app, actor), actor, sign: sign(actor) })
const all = async <R>(sql: string, values: unknown[] = []) => (await su.query(sql, values)).rows as R[]
const one = async <R>(sql: string, values: unknown[] = []) => (await all<R>(sql, values))[0]
const run = (kind: string, name: string, actor: string, dry = false) => imported(as(actor), kind, name, sample(name), dry)
const states = (lines: { line: number; done: { state: string } }[]) => Object.fromEntries(lines.map((l) => [l.line, l.done.state]))

before(async () => {
  await su.connect()
  await shell.start('2026-10-24')
  app = new pg.Client({ user: 'cella_app' })
  await app.connect()
})

after(async () => {
  await app.end()
  await shell.stop()
  await su.end()
})

test('Camille tries the members\' list in a dry run, then imports it: Nadia and Olivier invited, Rose refused', async () => {
  const file = { name: 'members.csv', type: 'text/csv', bytes: sample('members.csv') }
  const dry = await shell.upload('/imports', 'run', { kind: 'members', mode: 'dry' }, { file }, camille)
  assert.equal(dry.state, 'settled', dry.reason)
  assert.equal((await one<{ n: number }>(`SELECT count(*)::int AS n FROM membership.member WHERE address IN ('nadia@lanterne.example', 'olivier@lanterne.example')`)).n, 0)
  const tried = await one<{ id: string; dry: boolean; settled: number; refused: number }>(`SELECT id, dry, settled, refused FROM import.run ORDER BY id DESC LIMIT 1`)
  assert.deepEqual({ dry: tried.dry, settled: tried.settled, refused: tried.refused }, { dry: true, settled: 2, refused: 1 })
  const page = await shell.page(`/imports/${tried.id}`, camille)
  assert.match(page.text, /What it would make/)
  assert.match(page.text, /a member needs an address and a name/)

  const real = await shell.upload('/imports', 'run', { kind: 'members', mode: 'import' }, { file }, camille)
  assert.equal(real.state, 'settled', real.reason)
  const invited = await all<{ address: string; status: string }>(`SELECT address, status FROM membership.member WHERE address LIKE '%@lanterne.example' AND address IN ('nadia@lanterne.example', 'olivier@lanterne.example', 'rose@lanterne.example') ORDER BY address`)
  assert.deepEqual(invited, [{ address: 'nadia@lanterne.example', status: 'invited' }, { address: 'olivier@lanterne.example', status: 'invited' }])
  const waiting = await one<{ links: number; taken: number }>(
    `SELECT (SELECT count(*)::int FROM membership.link WHERE member IN ($1, $2)) AS links, (SELECT count(*)::int FROM membership.invitation WHERE member IN ($1, $2)) AS taken`,
    ['nadia@lanterne.example', 'olivier@lanterne.example'],
  )
  assert.deepEqual(waiting, { links: 0, taken: 0 }, 'each is given a link from their page, and has taken up nothing yet')
})

test('Julien carries October over from the old books: two entries posted, the rental account opened, two refused', async () => {
  const before = await one<{ n: number }>('SELECT count(*)::int AS n FROM transaction.entry')
  const { lines } = await run('fec', 'fec-2026-10.txt', julien)
  assert.deepEqual(states(lines), { 2: 'settled', 5: 'settled', 8: 'refused', 10: 'refused' })
  assert.match(lines[2].done.reason ?? '', /does not balance/)
  assert.match(lines[3].done.reason ?? '', /dated 2025-01-01, in no period of the books/)
  assert.equal((await one<{ n: number }>('SELECT count(*)::int AS n FROM transaction.entry')).n, before.n + 2)
  const rental = await one<{ kind: string; parent: string | null }>(`SELECT kind, parent FROM account.account WHERE code = '6135'`)
  assert.deepEqual(rental, { kind: 'expense', parent: '613' })
  assert.equal(await one(`SELECT code FROM account.account WHERE code = '6226'`), undefined, 'the refused entry opened nothing')
  const balance = await one<{ d: string; c: string }>(
    `SELECT sum(cella.cents(amount)) FILTER (WHERE side = 'debit') AS d, sum(cella.cents(amount)) FILTER (WHERE side = 'credit') AS c FROM transaction.line`,
  )
  assert.equal(balance.d, balance.c)
  const logged = await one<{ op: string; form: { opened: string[] } }>(`SELECT op, form FROM cella.log WHERE n = $1`, [lines[0].done.entry])
  assert.deepEqual([logged.op, logged.form.opened], ['account-transaction:entry:carry', ['6135']])
  // The rental was paid from the bank before cella: carried over, it may
  // touch a cash account, as a post may not.
  const paid = await one<{ n: number }>(`SELECT count(*)::int AS n FROM transaction.line l JOIN transaction.entry e ON e.id = l.entry WHERE e.label LIKE 'HA HA-0101%' AND l.account = '512'`)
  assert.equal(paid.n, 1)
})

test('Julien issues the spreadsheet\'s invoices, numbered in the series and posted; one with no client and one with no address are refused', async () => {
  const { lines } = await run('invoices', 'invoices.csv', julien)
  assert.deepEqual(states(lines), { 2: 'settled', 4: 'settled', 5: 'failed', 6: 'refused' })
  assert.match(lines[3].done.reason ?? '', /F-2026-0061 does not issue without the address it bills/)
  const issued = await all<{ id: string; bill_to: string; total: string }>(
    `SELECT i.id, i.bill_to, cella.cents(i.total)::text AS total FROM invoice.invoice i WHERE i.bill_to IN ('Atelier Ondine', 'Vélo Solidaire') AND i.issued = '2026-10-24' ORDER BY i.id`,
  )
  assert.deepEqual(issued, [
    { id: 'F-2026-0059', bill_to: 'Atelier Ondine', total: '176400' },
    { id: 'F-2026-0060', bill_to: 'Vélo Solidaire', total: '42000' },
  ])
  const posted = await one<{ n: number }>(`SELECT count(*)::int AS n FROM invoice_transaction.posting WHERE invoice IN ('F-2026-0059', 'F-2026-0060') AND event = 'issue'`)
  assert.equal(posted.n, 2)
})

test('Inès brings her own time from Toggl and Harvest; others\' rows are refused', async () => {
  const toggl = await run('toggl', 'toggl.csv', ines)
  assert.deepEqual(states(toggl.lines), { 2: 'settled', 3: 'settled', 4: 'settled', 5: 'refused', 6: 'failed' })
  assert.match(toggl.lines[3].done.reason ?? '', /ines@lanterne.example may not log time for thomas@lanterne.example/)
  const harvest = await run('harvest', 'harvest.csv', ines)
  assert.deepEqual(states(harvest.lines), { 2: 'settled', 3: 'settled', 4: 'refused' })
  const booked = await all<{ day: string; minutes: number; project: string | null }>(
    `SELECT to_char(e.day, 'YYYY-MM-DD') AS day, e.minutes, b.project FROM timesheet.entry e
     LEFT JOIN project_timesheet.booking b ON b.entry = e.id
     WHERE e.member = $1 AND e.note IN ('Basket checks', 'Team meeting', 'Accessibility audit', 'Basket proofs', 'Expenses') ORDER BY e.day`,
    [ines],
  )
  assert.deepEqual(booked, [
    { day: '2026-10-19', minutes: 210, project: 'halles-shop' },
    { day: '2026-10-20', minutes: 60, project: null },
    { day: '2026-10-21', minutes: 195, project: 'clairval-site' },
    { day: '2026-10-22', minutes: 150, project: 'halles-shop' },
    { day: '2026-10-23', minutes: 45, project: null },
  ])
})

test('Camille brings contacts, projects and Asana\'s tasks, leaving out what is held already or done', async () => {
  const contacts = await run('contacts', 'contacts.csv', camille)
  assert.deepEqual(states(contacts.lines), { 2: 'settled', 3: 'settled', 4: 'settled', 5: 'failed' })
  assert.match(contacts.lines[3].done.reason ?? '', /holds this contact already, as ferrand/)
  assert.equal(contacts.lines[2].label, 'a person, line 4')
  const projects = await run('projects', 'projects.csv', camille)
  assert.deepEqual(states(projects.lines), { 2: 'settled', 3: 'settled', 4: 'failed' })
  const tasks = await run('tasks', 'tasks.csv', camille)
  assert.deepEqual(states(tasks.lines), { 2: 'settled', 3: 'settled', 4: 'failed', 5: 'settled', 6: 'failed' })
  const filed = await all<{ title: string; project: string | null }>(
    `SELECT t.title, f.project FROM task.task t LEFT JOIN project_task.filing f ON f.task = t.id
     WHERE t.title IN ('Print the dielines for the gift box', 'Photograph the new range', 'Sort the shared drive') ORDER BY t.title`,
  )
  assert.deepEqual(filed, [
    { title: 'Photograph the new range', project: 'ferrand-packaging' },
    { title: 'Print the dielines for the gift box', project: 'ferrand-packaging' },
    { title: 'Sort the shared drive', project: null },
  ])
})

test('every run is recorded, and `cella import` runs the same import from the command line', async () => {
  const runs = await all<{ kind: string; dry: boolean; settled: number; refused: number }>('SELECT kind, dry, settled, refused FROM import.run ORDER BY id')
  assert.deepEqual(
    runs.map((r) => `${r.kind}${r.dry ? ' (dry)' : ''} ${r.settled}/${r.refused}`),
    ['members (dry) 2/1', 'members 2/1', 'fec 2/2', 'invoices 2/2', 'toggl 3/2', 'harvest 2/1', 'contacts 3/1', 'projects 2/1', 'tasks 3/2'],
  )
  const tool = new URL('../../../../tools/import.mjs', import.meta.url).pathname
  const out = spawnSync(process.execPath, [tool, 'projects', new URL('projects.csv', dir).pathname, camille, '--dry-run'], { encoding: 'utf8', env: process.env })
  assert.equal(out.status, 0, out.stderr)
  assert.match(out.stdout, /projects\.csv: 0 would settle, 3 refused, all undone/)
  const listed = spawnSync(process.execPath, [tool, 'spreadsheets', 'x.csv', camille], { encoding: 'utf8', env: process.env })
  assert.equal(listed.status, 2)
  assert.match(listed.stderr, /there is no import of spreadsheets; there are:/)
})
