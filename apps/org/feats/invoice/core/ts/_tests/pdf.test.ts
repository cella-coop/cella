// An issued invoice's PDF, on a database holding only the app's core and
// this feat: it prints the seller's mentions as the scope's settings named
// them when it issued, a decimal VAT rate,
// the address billed as issued, each line, the VAT by rate adding up to
// the invoice's, and the terms of payment; it is a well-formed PDF, the
// same bytes each time, breaking onto pages with the mentions on each;
// and an invoice lacking a mention of its buyer or its seller is refused
// at issue (`invoice.identified`), spending no number.
// Run by `cella test slice invoice`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { hundredths, type Deps } from '@cella/org-db'
import { fixture, signer } from '@cella/org-sign'
import { issue, pdf, printed, slice } from '../src/api/index.ts'
import type { Issue } from '../src/models/index.ts'

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

// The text a PDF's pages print, as its WinAnsi bytes read.
const text = (bytes: Uint8Array) => new TextDecoder('windows-1252').decode(bytes)
const nbsp = ' '

const draft = (lines: Issue['lines']): Issue => ({
  series: 'F-2026',
  bill_to: 'Les Halles Paysannes',
  bill_address: '8 place du Marché\n93100 Montreuil',
  label: 'Online shop (milestone 1 of 4): design',
  lines,
})

async function issued(input: Issue): Promise<string> {
  const out = await issue(input, as)
  assert.equal(out.state, 'settled', out.state === 'refused' ? out.reason : '')
  return (out as { value: { invoice: string } }).value.invoice
}

before(async () => {
  await db.connect()
  // Every actor holds every power, in place of core's guard on every power,
  // which reads seats and mandates this test does not make.
  await db.query(`DELETE FROM cella.guard WHERE fn = 'circle_person.empowered(jsonb)'::regprocedure`)
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

test('the PDF prints the seller, the buyer as issued, each line, the VAT by rate and the terms', async () => {
  const id = await issued(
    draft([
      { description: 'Design, 2.5 days', quantity: '2.5', unit_price: 600_00, vat_rate: 2000 },
      { description: 'Printed catalogue', quantity: '1', unit_price: 333_33, vat_rate: 1000 },
    ]),
  )
  const p = await printed(db, id)
  assert.ok(p)
  assert.deepEqual(
    p.taxed.map((t) => [t.rate, t.base, t.tax]),
    [
      ['10.00', 333_33, 33_33],
      ['20.00', 1500_00, 300_00],
    ],
  )
  assert.equal(p.taxed.reduce((s, t) => s + t.tax, 0), p.invoice.vat, 'the rates add up to the VAT issued')
  const printedText = text(pdf(p))
  for (const mention of [
    'Lanterne Worker Co-operative, worker co-operative limited company with variable capital',
    'Registered office: 14 rue des Graviers, 93100 Montreuil, France',
    `SIREN 123${nbsp}456${nbsp}789`,
    'Trade register RCS Bobigny',
    'EU VAT number FR12123456789',
    'INVOICE',
    'No. F-2026-0001',
    `Date of issue: 24${nbsp}October${nbsp}2026`,
    `Due date: 23${nbsp}November${nbsp}2026`,
    'Bill to',
    '(Les Halles Paysannes)',
    '(8 place du Marché)',
    '(93100 Montreuil)',
    'Subject: Online shop \\(milestone 1 of 4\\): design',
    '(Design, 2.5 days)',
    '(2.5)',
    '(€600.00)',
    '(€1,500.00)',
    '(10%)',
    '(VAT 20% on €1,500.00)',
    '(€300.00)',
    '(VAT 10% on €333.33)',
    '(€33.33)',
    '(€1,833.33)',
    '(€2,166.66)',
    '(Net unit price)',
    '(Net amount)',
    'Total excl. VAT',
    'Total incl. VAT',
    'Payment terms',
    'No discount for early payment',
    'L441-10',
    '€40.00',
    'D441-5',
  ]) {
    assert.ok(printedText.includes(mention), `the PDF prints ${mention}`)
  }
  for (const french of ['Facture', 'FACTURE', 'TVA', 'HT)', 'TTC', 'Siège', 'Échéance', 'Objet', 'escompte', 'pénalités']) {
    assert.ok(!printedText.includes(french), `the PDF prints no French: ${french}`)
  }
  assert.equal(p.invoice.total, 2166_66)
})

test('the PDF is well formed, and the same invoice makes the same bytes', async () => {
  const p = await printed(db, 'F-2026-0001')
  assert.ok(p)
  const bytes = pdf(p)
  assert.deepEqual(pdf(p), bytes)
  const raw = text(bytes)
  assert.ok(raw.startsWith('%PDF-1.4\n'))
  assert.ok(raw.endsWith('%%EOF\n'))
  // Each object stands where the cross-reference table says, and the
  // table where `startxref` says.
  const xref = Number(/startxref\n(\d+)\n/.exec(raw)?.[1])
  assert.equal(raw.slice(xref, xref + 4), 'xref')
  const offsets = [...raw.slice(xref).matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]))
  assert.ok(offsets.length >= 6)
  offsets.forEach((o, i) => assert.equal(raw.slice(o, o + `${i + 1} 0 obj`.length), `${i + 1} 0 obj`))
  // Each stream is as long as its dictionary says.
  for (const m of raw.matchAll(/<< \/Length (\d+) >>\nstream\n/g)) {
    const start = (m.index ?? 0) + m[0].length
    assert.equal(raw.slice(start + Number(m[1]), start + Number(m[1]) + '\nendstream'.length), '\nendstream')
  }
})

test('a long invoice breaks onto pages, each with the seller\'s mentions and its number', async () => {
  const lines = Array.from({ length: 40 }, (_, n) => ({
    description: `Shop upkeep, week ${n + 1}: product photography, catalogue updates and a review of the orders`,
    quantity: '1',
    unit_price: 100_00,
    vat_rate: 2000,
  }))
  const id = await issued(draft(lines))
  const p = await printed(db, id)
  assert.ok(p)
  const raw = text(pdf(p))
  const pages = Number(/\/Count (\d+)/.exec(raw)?.[1])
  assert.ok(pages >= 2, `${pages} pages`)
  for (let n = 1; n <= pages; n++) {
    assert.ok(raw.includes(`${id} · page ${n}/${pages}`))
  }
  assert.equal(raw.split('RCS Bobigny').length - 1, pages, 'the seller\'s mentions close each page')
  assert.equal(raw.split('(Description)').length - 1, pages, 'the lines\' header starts each page they run on')
})

test('a voided invoice\'s PDF is marked VOID, with the day it was voided', async () => {
  const p = await printed(db, 'F-2026-0001')
  assert.ok(p)
  assert.ok(!text(pdf(p)).includes('VOID'))
  const voided = text(pdf({ ...p, invoice: { ...p.invoice, voided: '2026-10-25' } }))
  assert.ok(voided.includes(`VOID on 25${nbsp}October${nbsp}2026`))
})

test('the address billed is issued with the invoice and never changes', async () => {
  await assert.rejects(
    db.query(`UPDATE invoice.invoice SET bill_address = 'elsewhere' WHERE id = 'F-2026-0001'`),
    /is issued and never changes/,
  )
})

test('the seller is kept as issued: a seat that moves later never alters an issued invoice', async () => {
  await db.query(`SET cella.scope_seat = '3 avenue Gambetta, 75020 Paris, France'`)
  try {
    const before = await printed(db, 'F-2026-0001')
    assert.ok(before)
    assert.equal(before.seller.seat, settings.scope_seat)
    assert.ok(text(pdf(before)).includes(`Registered office: ${settings.scope_seat}`))
    const id = await issued(draft([{ description: 'Upkeep', quantity: '1', unit_price: 300_00, vat_rate: 2000 }]))
    const moved = await printed(db, id)
    assert.equal(moved?.seller.seat, '3 avenue Gambetta, 75020 Paris, France', 'an invoice issued after the move names the new seat')
    await assert.rejects(
      db.query(`UPDATE invoice.invoice SET seller = invoice.seller() WHERE id = 'F-2026-0001'`),
      /is issued and never changes/,
    )
  } finally {
    await db.query(`SET cella.scope_seat = ${db.escapeLiteral(settings.scope_seat)}`)
  }
})

test('a VAT rate with a decimal issues, sent in hundredths: 5.5% and 2.1%', async () => {
  const id = await issued(
    draft([
      { description: 'Books', quantity: '3', unit_price: 19_99, vat_rate: 550 },
      { description: 'Press', quantity: '1', unit_price: 120_00, vat_rate: 210 },
    ]),
  )
  const p = await printed(db, id)
  assert.ok(p)
  assert.deepEqual(
    p.taxed.map((t) => [t.rate, t.base, t.tax]),
    [
      ['2.10', 120_00, 2_52],
      ['5.50', 59_97, 3_30],
    ],
  )
  assert.equal(p.invoice.vat, 5_82)
  assert.deepEqual(p.invoice.lines.map((l) => l.vat_rate), ['5.50', '2.10'])
  const raw = text(pdf(p))
  assert.ok(raw.includes('(VAT 5.5% on €59.97)'))
  assert.ok(raw.includes('(VAT 2.1% on €120.00)'))
})

test('the form reads a VAT rate in percent into hundredths, and refuses more than two decimals', () => {
  assert.equal(hundredths('20'), 2000)
  assert.equal(hundredths('5,5'), 550)
  assert.equal(hundredths('2.1'), 210)
  assert.equal(hundredths('0'), 0)
  assert.throws(() => hundredths('5,555'), /at most two decimals/)
  assert.throws(() => hundredths('-5'), /at most two decimals/)
})

test('an invoice\'s bytes are its PDF, for whoever reads it', async () => {
  const content = slice.collections?.invoices.content
  assert.ok(content)
  const found = await content(db, 'F-2026-0001', null)
  assert.ok(found)
  assert.equal(found.name, 'F-2026-0001.pdf')
  assert.equal(found.type, 'application/pdf')
  assert.equal(found.open, true)
  assert.equal(await content(db, 'F-2026-9999', null), null)
})

// The series' next number, which a refused issue never spends.
const next = async () => Number((await db.query<{ next: number }>(`SELECT next FROM invoice.series WHERE name = 'F-2026'`)).rows[0].next)

async function refused(input: Issue): Promise<string> {
  const before = await next()
  const out = await issue(input, as)
  assert.equal(out.state, 'refused')
  assert.equal(await next(), before, 'a refused issue spends no number')
  return out.state === 'refused' ? out.reason : ''
}

// Unsets one of the seller's settings around `run`, as a scope whose host
// had not made it.
async function without(setting: string, run: () => Promise<void>) {
  await db.query(`SET cella.${setting} = ''`)
  try {
    await run()
  } finally {
    await db.query(`SET cella.${setting} = ${db.escapeLiteral(settings[setting as keyof typeof settings])}`)
  }
}

const one = draft([{ description: 'Design, 1 day', quantity: '1', unit_price: 600_00, vat_rate: 2000 }])

test('an invoice whose address billed is blank is refused at issue, and spends no number', async () => {
  for (const bill_address of ['', '  \n ']) {
    assert.match(await refused({ ...one, bill_address }), /^F-2026-\d{4} does not issue without the address it bills: an issued invoice is corrected only by a void/)
  }
  assert.match(await refused({ ...one, bill_to: ' ' }), /does not issue without the name it bills/)
})

test('an invoice whose seller lacks its legal name, form, seat, SIREN or registry is refused, naming the setting', async () => {
  const named = {
    scope_legal_name: 'legal name',
    scope_form: 'legal form',
    scope_seat: 'seat',
    scope_siren: 'SIREN',
    scope_rcs: 'registry',
  }
  for (const [setting, what] of Object.entries(named)) {
    await without(setting, async () => {
      const reason = await refused(one)
      assert.ok(reason.includes(`the seller's ${what} (cella.${setting})`), reason)
    })
  }
})

test('the seller\'s VAT number is required where a line carries VAT, and not on an invoice without VAT', async () => {
  await without('scope_vat', async () => {
    assert.match(await refused(one), /the seller's VAT number \(cella\.scope_vat\), as a line carries VAT/)
    const id = await issued(draft([{ description: 'Training, exempt', quantity: '1', unit_price: 900_00, vat_rate: 0 }]))
    const p = await printed(db, id)
    assert.ok(p)
    assert.equal(p.seller.vat, null)
    assert.equal(p.invoice.vat, null)
    assert.ok(!text(pdf(p)).includes('EU VAT number'))
  })
})
