// Billing a client, on a database holding the app's core, the contact and
// invoice feats and this graft: an invoice is linked only to a contact
// holding the client role, and linking one that holds none is refused,
// naming it and what would fix it, and leaves no row; once the contact's
// own update sets the role, the same link settles; and an issued invoice
// keeps the name and address it billed when the contact is renamed. Run
// by `cella test slice contact-invoice`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import type { Deps } from '@cella/org-db'
import { fixture, signer } from '@cella/org-sign'
import { add, update } from '@cella/org-contact/api'
import { issue } from '@cella/org-invoice/api'
import { billed, link } from '../src/api/index.ts'

const db = new pg.Client()
const scope = 'test.example'
const julien = 'julien@test.example'
const as: Deps = { db, actor: julien, sign: signer(scope, julien, fixture(julien, 'laptop')) }

const settings = {
  scope: scope,
  scope_legal_name: 'Lanterne Worker Co-operative',
  scope_form: 'worker co-operative limited company with variable capital',
  scope_siren: '123456789',
  scope_rcs: 'Bobigny',
  scope_vat: 'FR12123456789',
  scope_seat: '14 rue des Graviers, 93100 Montreuil, France',
}

const reason = (out: { state: string; reason?: string }) => (out.state === 'refused' ? (out.reason ?? '') : `not refused: ${out.state}`)
const settled = (out: { state: string; reason?: string }) => assert.equal(out.state, 'settled', out.state === 'refused' ? out.reason : '')
const billings = async (invoice: string) => (await db.query('SELECT contact FROM contact_invoice.billing WHERE invoice = $1', [invoice])).rows

async function issued(bill_to: string): Promise<string> {
  const out = await issue(
    {
      series: 'F-2026',
      bill_to,
      bill_address: '8 place du Marché\n93100 Montreuil',
      label: 'Online shop (milestone 1 of 4): design',
      lines: [{ description: 'Design, 2.5 days', quantity: '2.5', unit_price: 600_00, vat_rate: 2000 }],
    },
    as,
  )
  settled(out)
  return (out as { value: { invoice: string } }).value.invoice
}

before(async () => {
  await db.connect()
  await db.query(`SET cella.clock = '2026-10-24'`)
  for (const [k, v] of Object.entries(settings)) {
    await db.query(`SET cella.${k} = ${db.escapeLiteral(v)}`)
  }
  // Any device signs for anyone, in place of core person's keyring.
  await db.query(`CREATE FUNCTION public.anyone(actor text, device bytea) RETURNS text LANGUAGE sql STABLE RETURN NULL`)
  await db.query('DELETE FROM cella.keyring')
  await db.query(`INSERT INTO cella.keyring (fn, owner) VALUES ('public.anyone(text, bytea)', 'test')`)
  await db.query(`INSERT INTO invoice.series (name, next) VALUES ('F-2026', 1)`)
})

after(async () => {
  await db.end()
})

test('only the app\'s core, the contact and invoice feats and this graft are migrated', async () => {
  const { rows } = await db.query(`SELECT nspname FROM pg_namespace WHERE nspname IN ('project', 'contact_project', 'invoice_project')`)
  assert.deepEqual(rows, [])
})

test('a contact with no client role is refused as whom an invoice bills, and no row is left', async () => {
  settled(await add({ id: 'halles', name: 'Les Halles Paysannes', form: 'SCIC SA' }, as))
  settled(await add({ id: 'halles-roux', kind: 'person', person: 'margaux.roux@halles-paysannes.example', parent: 'halles', name: 'Margaux Roux' }, as))
  const invoice = await issued('Les Halles Paysannes')
  for (const contact of ['halles', 'halles-roux']) {
    assert.match(reason(await link({ invoice, contact }, as)), new RegExp(`${contact} is no client, so no invoice bills it: set its client role on its page first`))
  }
  assert.deepEqual(await billings(invoice), [])
  assert.deepEqual((await billed(db, invoice)).contacts, [], 'the picker offers no contact that is no client')

  settled(await update({ id: 'halles', fields: { client: 'active' } }, as))
  settled(await link({ invoice, contact: 'halles' }, as))
  assert.deepEqual(await billings(invoice), [{ contact: 'halles' }])
  const read = await billed(db, invoice)
  assert.deepEqual(read.contact, { id: 'halles', name: 'Les Halles Paysannes' })
  assert.deepEqual(read.contacts, [{ id: 'halles', name: 'Les Halles Paysannes' }], 'the picker offers the clients alone')
})

test('an issued invoice keeps the name and address it billed after the contact is renamed', async () => {
  const invoice = await issued('Les Halles Paysannes')
  settled(await link({ invoice, contact: 'halles' }, as))
  settled(await update({ id: 'halles', fields: { name: 'Halles Paysannes SCIC' } }, as))
  const { rows } = await db.query('SELECT bill_to, bill_address FROM invoice.invoice WHERE id = $1', [invoice])
  assert.deepEqual(rows[0], { bill_to: 'Les Halles Paysannes', bill_address: '8 place du Marché\n93100 Montreuil' })
  assert.equal((await billed(db, invoice)).contact?.name, 'Halles Paysannes SCIC', 'the link reads the contact as it is now')
})

test('clearing the client role leaves the links already made, and refuses the next', async () => {
  const invoice = await issued('Les Halles Paysannes')
  settled(await update({ id: 'halles', fields: { client: null } }, as))
  assert.match(reason(await link({ invoice, contact: 'halles' }, as)), /halles is no client/)
  assert.deepEqual(await billings(invoice), [])
  assert.equal((await db.query(`SELECT count(*) AS n FROM contact_invoice.billing WHERE contact = 'halles'`)).rows[0].n, '2')
})
