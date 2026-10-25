// The files scenario, end to end on a seeded Lanterne, through the built
// shell: Thomas claims his train with its receipt in one write from the
// expenses' New form, and the receipt is a file about him, logged only as
// commitments. Who opens a file: the co-op's statutes anyone; Sofia's
// receipt Sofia and Julien, whose finance seat reimburses expenses, and
// not Inès or Thomas; Inès's contract Inès and Camille, who hires, and
// not Thomas. Léa attaches a receipt to her own expense and not to
// Sofia's; Camille files Inès's amended contract on her worker page and
// Thomas may not; Camille files a record of her own and not of Hugo's;
// and Thomas uploads a paper of the co-op's own from the Files page. Run
// by `cella test e2e files`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { Shell } from './serve.ts'

const su = new pg.Client()
const shell = new Shell(su)

const camille = 'camille@lanterne.example'
const julien = 'julien@lanterne.example'
const thomas = 'thomas@lanterne.example'
const sofia = 'sofia@lanterne.example'
const lea = 'lea@lanterne.example'
const ines = 'ines@lanterne.example'

const pdf = (text: string) => ({ name: `${text.replace(/\W+/g, '-')}.pdf`, type: 'application/pdf', bytes: new TextEncoder().encode(`%PDF-1.4\n% ${text}\n%%EOF\n`) })
const one = async <R>(sql: string, values: unknown[] = []) => (await su.query(sql, values)).rows[0] as R

before(async () => {
  await su.connect()
  await shell.start('2026-10-24')
})

after(async () => {
  await shell.stop()
  await su.end()
})

test('Thomas claims his train with its receipt in one write, the receipt a file about him', async () => {
  const done = await shell.upload(
    '/expenses',
    'capture',
    { label: 'Train to Clairval, second visit', day: '2026-10-23', category: '6251', net: '78,55', vat: '7,85' },
    { file: pdf('sncf 1023') },
    thomas,
  )
  assert.equal(done.state, 'settled', done.reason)
  const e = await one<{ id: string; file: string }>(
    `SELECT e.id, r.file FROM expense.expense e JOIN expense_file.receipt r ON r.expense = e.id WHERE e.label = 'Train to Clairval, second visit'`,
  )
  const f = await one<{ class: string; subject: string; uploader: string; name: string }>('SELECT class, subject, uploader, name FROM file.file WHERE id = $1', [e.file])
  assert.deepEqual(f, { class: 'expense-receipt', subject: thomas, uploader: thomas, name: 'sncf-1023.pdf' })
  const logged = await one<{ form: Record<string, any> }>(`SELECT form FROM cella.log WHERE n = $1`, [done.entry])
  assert.equal(logged.form.file, e.file)
  assert.ok(!JSON.stringify(logged.form).includes('sncf-1023'), 'the receipt’s name is committed to, not logged')
  const page = await shell.page(`/expenses/${e.id}`, thomas)
  assert.match(page.text, /sncf-1023\.pdf/)
})

test('who opens a file: the person it concerns, who uploaded it, and a power over what it records', async () => {
  const opens = async (id: string, who: string) => (await shell.page(`/files/${id}/content`, who)).status
  // fi-0001, the statutes, the co-op's own.
  const statutes = await shell.page('/files/fi-0001/content', ines)
  assert.equal(statutes.status, 200)
  assert.equal(statutes.type, 'application/pdf')
  assert.match(statutes.text, /^%PDF-1\.4/)
  // fi-0004, Sofia's receipt.
  assert.equal(await opens('fi-0004', sofia), 200)
  assert.equal(await opens('fi-0004', julien), 200, 'finance reimburses expenses')
  assert.equal(await opens('fi-0004', ines), 403)
  assert.equal(await opens('fi-0004', thomas), 403)
  // fi-0003, Inès's contract.
  assert.equal(await opens('fi-0003', ines), 200)
  assert.equal(await opens('fi-0003', camille), 200, 'the manager hires')
  assert.equal(await opens('fi-0003', thomas), 403)
  assert.equal((await shell.page('/files/fi-0099/content', camille)).status, 404)
})

test('Léa attaches a receipt to her own expense, and not to Sofia\'s', async () => {
  const mine = await shell.upload('/expenses/ex-0004', 'attach', {}, { file: pdf('foundry invoice 2291') }, lea)
  assert.equal(mine.state, 'settled', mine.reason)
  const theirs = await shell.upload('/expenses/ex-0001', 'attach', {}, { file: pdf('not mine') }, lea)
  assert.equal(theirs.state, 'refused')
  assert.match(theirs.reason ?? '', /lea@lanterne.example may not attach a receipt to sofia@lanterne.example's expense/)
  assert.equal((await one<{ n: number }>(`SELECT count(*)::int AS n FROM expense_file.receipt WHERE expense = 'ex-0004'`)).n, 1)
})

test('whoever hires files a worker\'s records, and a member their own', async () => {
  const amended = await shell.upload(`/people/${ines}`, 'contract', {}, { file: pdf('avenant 1') }, camille)
  assert.equal(amended.state, 'settled', amended.reason)
  const refused = await shell.upload(`/people/${ines}`, 'contract', {}, { file: pdf('avenant 2') }, thomas)
  assert.equal(refused.state, 'refused')
  const page = await shell.page(`/people/${ines}`, camille)
  assert.match(page.text, /contrat-ines-haddad\.pdf/)
  assert.match(page.text, /avenant-1\.pdf/)
  const own = await shell.upload(`/people/${camille}`, 'record', {}, { file: pdf('rib') }, camille)
  assert.equal(own.state, 'settled', own.reason)
  const other = await shell.upload('/people/hugo@lanterne.example', 'record', {}, { file: pdf('rib hugo') }, camille)
  assert.match(other.reason ?? '', /camille@lanterne.example may not file a record of hugo@lanterne.example/)
})

test('Thomas uploads a paper of the co-op\'s own, which anyone opens', async () => {
  const done = await shell.upload('/files', 'upload', {}, { file: pdf('reglement interieur v3') }, thomas)
  assert.equal(done.state, 'settled', done.reason)
  const f = await one<{ id: string; class: string }>(`SELECT id, class FROM file.file WHERE name = 'reglement-interieur-v3.pdf'`)
  assert.equal(f.class, 'none')
  assert.equal((await shell.page(`/files/${f.id}/content`, ines)).status, 200)
  const list = await shell.page('/files', thomas)
  assert.match(list.text, /reglement-interieur-v3\.pdf/)
  const refused = await shell.upload('/files', 'upload', {}, {}, thomas)
  assert.equal(refused.state, 'failed')
  assert.match(refused.reason ?? '', /choose a file to upload/)
})
