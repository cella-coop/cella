// The bills alone, on a database holding only the app's core and this
// feat: a bill is numbered and adds up line by line, as the VAT core
// library counts it; it merges by its supplier's reference, moves only
// along its lifecycle and keeps its figures and lines; and the guards
// refuse a write that did not do what it says. Run by `cella test slice
// bill`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { priced } from '@cella/org-vat'

const db = new pg.Client()
const julien = 'julien@lanterne.example'
const camille = 'camille@lanterne.example'

const refused = async (run: () => Promise<unknown>, says: RegExp) => {
  await db.query('BEGIN')
  try {
    await assert.rejects(run(), (e: Error & { code?: string }) => {
      assert.equal(e.code, '09000', e.message)
      assert.match(e.message, says)
      return true
    })
  } finally {
    await db.query('ROLLBACK')
  }
}

const guard = async (fn: string, payload: object) =>
  (await db.query<{ r: string | null }>(`SELECT bill.${fn}($1) AS r`, [payload])).rows[0].r

// Records a bill as the record handler does, its amounts from its lines
// by `priced`, inside one transaction so the deferred check runs at its
// end.
const lines = [
  { description: 'Paper, a ream', quantity: '40', unit_price: 3000, vat_rate: 2000 },
  { description: 'Delivery', quantity: '1', unit_price: 2550, vat_rate: 550 },
  { description: 'Tax-free postage', quantity: '3', unit_price: 199, vat_rate: 0 },
]
const record = (reference: string, circle: string | null = null) =>
  db.query<{ id: string; net: string; vat: string; total: string }>(
    `WITH lines AS (${priced('$2')}),
     sums AS (SELECT sum(amount)::bigint AS net, sum(vat)::bigint AS vat FROM lines),
     made AS (
       INSERT INTO bill.bill (supplier, reference, issued, due, label, category, net, vat, total, recorded, recorder, circle)
       SELECT 'Imprimerie du Parc', $1, '2026-10-16', '2026-11-15', 'Paper stock', '606',
              cella.amount(net), cella.amount(vat), cella.amount(net + vat), '2026-10-24', $3, coalesce($4, circle.assembly())
       FROM sums RETURNING *
     ),
     lined AS (
       INSERT INTO bill.line (bill, circle, n, description, quantity, unit_price, amount, vat_rate)
       SELECT made.id, made.circle, n, description, quantity, cella.amount(unit_price), cella.amount(amount), vat_rate FROM made, lines
     )
     SELECT id, cella.cents(net) AS net, cella.cents(vat) AS vat, cella.cents(total) AS total FROM made`,
    [reference, JSON.stringify(lines), julien, circle],
  )

before(async () => {
  await db.connect()
  await db.query(`SET cella.clock = '2026-10-24'`)
})

after(async () => {
  await db.end()
})

test('only the app\'s core and this feat are migrated', async () => {
  const { rows } = await db.query(`SELECT nspname FROM pg_namespace WHERE nspname IN ('invoice', 'transaction', 'bill_transaction')`)
  assert.deepEqual(rows, [])
})

test('a bill is numbered and adds up line by line, its VAT by rate summing to its VAT', async () => {
  const { rows } = await record('FA-2026-1187')
  // 40 × 30 € and 25,50 € and 3 × 1,99 €; VAT 240 € and 1,40 € (25,50 at
  // 5,5 % is 1,4025, rounded to the cent).
  assert.deepEqual(rows[0], { id: 'bi-0001', net: '123147', vat: '24140', total: '147287' })
  const taxed = await db.query('SELECT rate::text AS rate, base::text AS base, tax::text AS tax FROM bill.taxed t WHERE t.bill = $1 ORDER BY t.rate', ['bi-0001'])
  assert.deepEqual(taxed.rows, [
    { rate: '0.00', base: '597', tax: '0' },
    { rate: '5.50', base: '2550', tax: '140' },
    { rate: '20.00', base: '120000', tax: '24000' },
  ])
})

test('a bill whose lines do not make its net or its VAT is refused', async () => {
  await refused(
    () => db.query(`
      WITH made AS (
        INSERT INTO bill.bill (supplier, reference, issued, due, label, category, net, vat, total, recorded, recorder)
        VALUES ('Atelier Lumen', 'LOY-2026-10', '2026-10-01', '2026-10-31', 'Rent', '613', cella.amount(90000), cella.amount(18100), cella.amount(108100), '2026-10-24', $1)
        RETURNING id
      )
      INSERT INTO bill.line (bill, n, description, quantity, unit_price, amount, vat_rate)
      SELECT id, 1, 'Rent', 1, cella.amount(90000), cella.amount(90000), 20 FROM made`, [julien]).then(() => db.query('SET CONSTRAINTS ALL IMMEDIATE')),
    /the lines' VAT makes 18000 cents, the bill 18100/,
  )
})

test('the same supplier\'s reference is one bill', async () => {
  await assert.rejects(record('FA-2026-1187'), (e: Error & { code?: string }) => e.code === '23505')
})

test('a bill moves only along its lifecycle, and its figures and lines never change', async () => {
  await refused(() => db.query(`UPDATE bill.bill SET status = 'paid', paid = '2026-10-24' WHERE id = 'bi-0001'`), /bi-0001 is recorded, and cannot become paid/)
  await refused(() => db.query(`UPDATE bill.bill SET label = 'Something else' WHERE id = 'bi-0001'`), /bi-0001 was recorded: its figures never change/)
  await refused(
    () => db.query(`UPDATE bill.bill SET status = 'approved', approved = '2026-10-24', approver = $1, due = '2026-12-31' WHERE id = 'bi-0001'`, [camille]),
    /bi-0001 was recorded: its figures never change/,
  )
  await refused(() => db.query(`UPDATE bill.line SET description = 'Card' WHERE bill = 'bi-0001' AND n = 1`), /the lines of bi-0001 never change once recorded/)
  await refused(() => db.query(`DELETE FROM bill.bill WHERE id = 'bi-0001'`), /bi-0001 was recorded and is never deleted/)
})

test('the guards refuse a write that did not do what it says, and an approval by the bill\'s recorder', async () => {
  // Outside a write there is no actor, so no record is this write's; a
  // merge names a bill recorded before.
  assert.equal(await guard('records', { bill: 'bi-0001', merged: false }), 'bi-0001 was not recorded by this write')
  assert.equal(await guard('records', { bill: 'bi-0001', merged: true }), null)
  assert.equal(await guard('records', { bill: 'bi-0099' }), 'no bill bi-0099')
  assert.equal(await guard('approves', { bill: 'bi-0001', amount: 147287 }), 'bi-0001 was not approved by this write')

  await db.query('BEGIN')
  await db.query(`UPDATE bill.bill SET status = 'approved', approved = '2026-10-24', approver = $1 WHERE id = 'bi-0001'`, [julien])
  assert.equal(await guard('approves', { bill: 'bi-0001', amount: 147287 }), `${julien} recorded bi-0001, and may not approve it too`)
  await db.query('ROLLBACK')

  await db.query(`UPDATE bill.bill SET status = 'approved', approved = '2026-10-24', approver = $1 WHERE id = 'bi-0001'`, [camille])
  assert.equal(await guard('approves', { bill: 'bi-0001', amount: 147287 }), 'bi-0001 was not approved by this write')
  assert.equal(await guard('pays', { bill: 'bi-0001', amount: 147287 }), 'bi-0001 was not paid by this write')
  await db.query(`UPDATE bill.bill SET status = 'paid', paid = '2026-10-24' WHERE id = 'bi-0001'`)
  assert.equal(await guard('pays', { bill: 'bi-0001', amount: 147287 }), null)
  assert.equal(await guard('pays', { bill: 'bi-0001', amount: 147000 }), 'bi-0001 comes to 147287 cents, not 147000')
  await refused(() => db.query(`UPDATE bill.bill SET status = 'paid', paid = '2026-10-25' WHERE id = 'bi-0001'`), /bi-0001 is paid already/)
})

// Last, since what it numbers is not rolled back.
test('a bill is owned by the circle it names, the root where it names none, and its lines by its own', async () => {
  const owners = async (id: string) =>
    (await db.query('SELECT DISTINCT b.circle, l.circle AS line FROM bill.bill b JOIN bill.line l ON l.bill = b.id WHERE b.id = $1', [id])).rows
  await db.query('BEGIN')
  await db.query(`INSERT INTO circle.circle (id, name) VALUES ('brand', 'Brand')`)
  assert.deepEqual(await owners((await record('FA-ROOT')).rows[0].id), [{ circle: 'ag', line: 'ag' }])
  assert.deepEqual(await owners((await record('FA-BRAND', 'brand')).rows[0].id), [{ circle: 'brand', line: 'brand' }])
  await assert.rejects(record('FA-WBE', 'wbe'), /bill_circle_fkey/)
  await db.query('ROLLBACK')
})
