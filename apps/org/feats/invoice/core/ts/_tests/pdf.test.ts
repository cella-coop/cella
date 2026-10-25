// An issued invoice's PDF, on a database holding only the app's core and
// this feat: it prints the seller's mentions as the scope's settings named
// them when it issued, a decimal VAT rate,
// the address billed as issued, each line, the VAT by rate adding up to
// the invoice's, and the terms of payment; it is a well-formed PDF, the
// same bytes each time, breaking onto pages with the mentions on each.
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
  scope_legal_name: 'Lanterne SCOP SARL',
  scope_form: 'SCOP SARL à capital variable',
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
  await db.query(`SET cella.clock = '2026-10-24'`)
  for (const [k, v] of Object.entries(settings)) {
    await db.query(`SET cella.${k} = ${db.escapeLiteral(v)}`)
  }
  // Any device signs for anyone: this slice has no keyring of its own.
  await db.query(`CREATE FUNCTION public.anyone(actor text, device bytea) RETURNS text LANGUAGE sql STABLE RETURN NULL`)
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
    'Lanterne SCOP SARL, SCOP SARL à capital variable',
    'Siège : 14 rue des Graviers, 93100 Montreuil, France',
    `SIREN 123${nbsp}456${nbsp}789`,
    'RCS Bobigny',
    'TVA intracommunautaire FR12123456789',
    'FACTURE',
    'N° F-2026-0001',
    'Date d’émission : 24/10/2026',
    'Échéance : 23/11/2026',
    'Facturé à',
    '(Les Halles Paysannes)',
    '(8 place du Marché)',
    '(93100 Montreuil)',
    'Objet : Online shop \\(milestone 1 of 4\\): design',
    '(Design, 2.5 days)',
    '(2,5)',
    `(600,00${nbsp}€)`,
    `(1${nbsp}500,00${nbsp}€)`,
    `(10${nbsp}%)`,
    `(TVA 20${nbsp}% sur 1${nbsp}500,00${nbsp}€)`,
    `(300,00${nbsp}€)`,
    `(TVA 10${nbsp}% sur 333,33${nbsp}€)`,
    `(33,33${nbsp}€)`,
    `(1${nbsp}833,33${nbsp}€)`,
    `(2${nbsp}166,66${nbsp}€)`,
    'Total TTC',
    'Pas d’escompte pour paiement anticipé',
    'L441-10',
    `40${nbsp}€`,
    'D441-5',
  ]) {
    assert.ok(printedText.includes(mention), `the PDF prints ${mention}`)
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
  assert.equal(raw.split('(Désignation)').length - 1, pages, 'the lines\' header starts each page they run on')
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
    assert.ok(text(pdf(before)).includes(`Siège : ${settings.scope_seat}`))
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

test('a VAT rate with a decimal issues, sent in hundredths: 5,5 % and 2,1 %', async () => {
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
  assert.ok(raw.includes(`(TVA 5,5${nbsp}% sur 59,97${nbsp}€)`))
  assert.ok(raw.includes(`(TVA 2,1${nbsp}% sur 120,00${nbsp}€)`))
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
