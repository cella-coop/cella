// Clients on a seeded Lanterne, through the built shell: a client is a
// contact the co-op bills, a role on the contact. The Clients view keeps
// the contacts holding it, its condition kept in the address, and leaves
// out Margaux Roux, a person at Les Halles who is no client; an invoice's
// picker offers clients only, and linking her is refused, naming her
// contact and what would fix it, leaving the billing as it was; Camille
// sets her role on her page, which makes her a client, and clears it
// again. Run by `cella test`, which builds the shell first, on a fresh
// database.
// covers: contact contact-invoice invoice

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { Shell } from './serve.ts'

const su = new pg.Client()
const shell = new Shell(su)

const camille = 'camille@lanterne.example'
const julien = 'julien@lanterne.example'

const page = (path: string, actor = camille) => shell.page(path, actor)
const act = (path: string, action: string, fields: Record<string, string>, actor: string) => shell.act(path, action, fields, actor)
const one = async <R>(sql: string, values: unknown[] = []) => (await su.query(sql, values)).rows[0] as R

before(async () => {
  await su.connect()
  await shell.start('2026-10-24')
})

after(async () => {
  await shell.stop()
  await su.end()
})

test('a client is a contact the co-op bills: the Clients view keeps them, and an invoice offers only them', async () => {
  const all = await page('/contacts')
  assert.ok(all.text.includes('href="/contacts/halles-roux"') && all.text.includes('Vélo Solidaire'), 'All lists every contact')
  const clients = await page('/contacts?v=clients')
  assert.equal(clients.status, 200)
  assert.ok(clients.text.includes('Vélo Solidaire') && clients.text.includes('Atelier Ondine'), 'the Clients view keeps the clients')
  assert.ok(!clients.text.includes('href="/contacts/halles-roux"'), 'and leaves out a contact that is no client')
  const roux = await page('/contacts/halles-roux')
  assert.ok(roux.text.includes('No client: set the role to bill it'), 'a contact\'s page shows its role')
  const invoice = await page('/invoices/F-2026-0044', julien)
  assert.match(invoice.text, /<option value="mauve"/)
  assert.doesNotMatch(invoice.text, /<option value="halles-roux"/, 'the invoice\'s picker offers clients only')
  const refused = await act('/invoices/F-2026-0044', 'link', { contact: 'halles-roux' }, julien)
  assert.equal(refused.state, 'refused')
  assert.match(refused.reason ?? '', /halles-roux is no client, so no invoice bills it: set its client role on its page first/)
  assert.equal((await one<{ contact: string }>(`SELECT contact FROM contact_invoice.billing WHERE invoice = 'F-2026-0044'`)).contact, 'mauve')

  const set = await act('/contacts/halles-roux', 'client', { client: 'lead' }, camille)
  assert.equal(set.state, 'settled')
  assert.ok((await page('/contacts?v=clients')).text.includes('href="/contacts/halles-roux"'), 'a contact given the role is a client')
  assert.ok((await page('/contacts/halles-roux')).text.includes('Client, lead'))
  assert.match((await page('/invoices/F-2026-0044', julien)).text, /<option value="halles-roux"/)
  const cleared = await act('/contacts/halles-roux', 'client', { client: '' }, camille)
  assert.equal(cleared.state, 'settled')
  assert.equal((await one<{ client: string | null }>(`SELECT client FROM contact.contact WHERE id = 'halles-roux'`)).client, null)
  assert.ok(!(await page('/contacts?v=clients')).text.includes('href="/contacts/halles-roux"'), 'and one cleared of it is no client')
})
