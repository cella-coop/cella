// seed: loads a mock co-op into the feat and graft schemas, as the state
// carried over from before the log: members and their seats, decisions with
// their stances, admissions, documents with their versions, comments and
// adoptions, clients, the chart, periods and journal, invoices with their
// payments, and the grafts' links. Stances, document updates, adoptions and
// payments take receipts in file order; a closed decision's cutoff is the receipt
// after its last stance. Seats load before decisions, whose rolls are fixed
// from them, and periods close after the journal is in.
// Usage: node tools/seed.mjs apps/org/fixtures/<co-op>

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { LoroDoc } from 'loro-crdt'
import { parse } from 'smol-toml'
import pg from 'pg'

const dir = process.argv[2]
const read = (file) => {
  const path = join(dir, `${file}.toml`)
  return existsSync(path) ? parse(readFileSync(path, 'utf8')) : {}
}
const day = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null)

const db = new pg.Client()
await db.connect()
await db.query('BEGIN')

const members = read('member').member ?? []
for (const m of members) {
  await db.query(
    'INSERT INTO member.member (address, name, status, since, shares) VALUES ($1, $2, $3, $4, $5)',
    [m.address, m.name, m.status, day(m.since), m.shares],
  )
}

const positions = read('graft.circle-member').position ?? []
for (const p of positions) {
  await db.query(
    'INSERT INTO circle_member.position (circle, member, role, since, until) VALUES ($1, $2, $3, $4, $5)',
    [p.circle, p.member, p.role ?? null, day(p.since), day(p.until)],
  )
}

const decisions = read('decision').decision ?? []
let votes = 0
for (const d of decisions) {
  await db.query(
    `INSERT INTO decision.decision (id, circle, title, rule, proposed, deadline, body)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [d.id, d.circle, d.title, d.rule, day(d.proposed), day(d.deadline), d.body ?? ''],
  )
  for (const v of d.vote ?? []) {
    await db.query(
      'INSERT INTO decision.vote (receipt, decision, member, stance, at) VALUES (cella.receipt(), $1, $2, $3, $4)',
      [d.id, v.member, v.stance, day(v.at)],
    )
    votes++
  }
  if (d.closed) {
    await db.query('UPDATE decision.decision SET closed = $2, cutoff = cella.receipt() WHERE id = $1', [d.id, day(d.closed)])
  }
}

const admissions = read('graft.decision-member').admission ?? []
for (const a of admissions) {
  await db.query('INSERT INTO decision_member.admission (decision, member, shares) VALUES ($1, $2, $3)', [a.decision, a.member, a.shares])
}

// Each document's versions become Loro updates, one per version in order,
// from one peer: the history before the log, with no author. A version
// records the frontier and version vector its update reached.
const documents = read('document')
let versions = 0
for (const d of documents.document ?? []) {
  await db.query('INSERT INTO document.document (id, title) VALUES ($1, $2)', [d.id, d.title])
  const loro = new LoroDoc()
  loro.setPeerId(1n)
  for (const v of d.version ?? []) {
    const from = loro.version()
    loro.getText('body').update(v.body)
    loro.commit()
    await db.query(
      'INSERT INTO document.update (receipt, document, author, at, bytes) VALUES (cella.receipt(), $1, NULL, $2, $3)',
      [d.id, day(v.saved), loro.export({ mode: 'update', from })],
    )
    await db.query(
      'INSERT INTO document.version (document, n, saved, body, frontier, vv) VALUES ($1, $2, $3, $4, $5, $6)',
      [d.id, Number(v.id.split('@')[1]), day(v.saved), v.body, JSON.stringify(loro.frontiers()), JSON.stringify(Object.fromEntries(loro.version().toJSON()))],
    )
    versions++
  }
}
for (const c of (documents.document ?? []).flatMap((d) => d.comment ?? [])) {
  await db.query(
    'INSERT INTO document.comment (version, author, at, quote, text) VALUES ($1, $2, $3, $4, $5)',
    [c.version, c.author, day(c.at), c.quote, c.text],
  )
}

// What decisions ask to adopt, and the adoptions already made, each from
// the version adopted before it.
const adoptions = read('graft.decision-document').adoption ?? []
for (const a of adoptions) {
  await db.query('INSERT INTO decision_document.adoption (decision, document, version) VALUES ($1, $2, $3)', [a.decision, a.document, a.version])
  if (a.adopted) {
    await db.query(
      `INSERT INTO document.adoption (receipt, document, version, base, adopted)
       VALUES (cella.receipt(), $1, $2, (SELECT version FROM document.adopted WHERE document = $1), $3)`,
      [a.document, a.version, day(a.adopted)],
    )
  }
}

const clients = read('client').client ?? []
for (const c of clients) {
  await db.query(
    'INSERT INTO client.client (id, kind, name, form, note) VALUES ($1, $2, $3, $4, $5)',
    [c.id, c.kind ?? 'company', c.name, c.form ?? null, c.note ?? ''],
  )
}

const books = read('account')
for (const a of books.account ?? []) {
  await db.query('INSERT INTO account.account (code, label, kind) VALUES ($1, $2, $3)', [a.code, a.label, a.kind])
}
for (const p of books.period ?? []) {
  await db.query('INSERT INTO account.period (month) VALUES ($1)', [p.month])
}

const entries = read('transaction').entry ?? []
for (const e of entries) {
  await db.query('INSERT INTO transaction.entry (id, date, label) VALUES ($1, $2, $3)', [e.id, day(e.date), e.label])
  for (const [i, l] of e.line.entries()) {
    const side = l.debit !== undefined ? 'debit' : 'credit'
    await db.query(
      'INSERT INTO transaction.line (entry, n, account, side, amount) VALUES ($1, $2, $3, $4, cella.amount($5))',
      [e.id, i + 1, l.account, side, l.debit ?? l.credit],
    )
  }
}

const invoicing = read('invoice')
const invoices = invoicing.invoice ?? []
const payments = new Map()
if (invoicing.series) {
  await db.query('INSERT INTO invoice.series (name, next) VALUES ($1, $2)', [invoicing.series, invoicing.next])
}
for (const i of invoices) {
  const number = Number(i.id.slice(invoicing.series.length + 1))
  await db.query(
    `INSERT INTO invoice.invoice (id, series, number, issued, due, bill_to, label, net, vat, total, voided, reason)
     VALUES ($1, $2, $3, $4, $5, $6, $7, cella.amount($8), cella.amount($9), cella.amount($10), $11, $12)`,
    [i.id, invoicing.series, number, day(i.issued), day(i.due), i.bill_to, i.label, i.net, i.vat || null, i.total, day(i.voided), i.reason ?? null],
  )
  // The fixture keeps totals; each invoice carries them as one line.
  await db.query(
    `INSERT INTO invoice.line (invoice, n, description, quantity, unit_price, amount, vat_rate)
     VALUES ($1, 1, $2, 1, cella.amount($3), cella.amount($3), $4)`,
    [i.id, i.label, i.net, (i.vat * 100) / i.net],
  )
  const ids = []
  for (const [n, p] of (i.payment ?? []).entries()) {
    const { rows } = await db.query(
      `INSERT INTO invoice.payment (invoice, receipt, at, amount, method, reference)
       VALUES ($1, cella.receipt(), $2, cella.amount($3), $4, $5) RETURNING id`,
      [i.id, day(p.at), p.amount, p.method ?? 'transfer', p.reference ?? `${i.id}/${n + 1}`],
    )
    ids.push(rows[0].id)
  }
  payments.set(i.id, ids)
}

const billings = read('graft.client-invoice').billing ?? []
for (const b of billings) {
  await db.query('INSERT INTO client_invoice.billing (invoice, client) VALUES ($1, $2)', [b.invoice, b.client])
}

const postings = read('graft.invoice-transaction').posting ?? []
const paid = new Map()
for (const p of postings) {
  let payment = null
  if (p.event === 'payment') {
    const n = paid.get(p.invoice) ?? 0
    payment = payments.get(p.invoice)?.[n] ?? null
    paid.set(p.invoice, n + 1)
  }
  await db.query(
    'INSERT INTO invoice_transaction.posting (entry, invoice, event, payment) VALUES ($1, $2, $3, $4)',
    [p.entry, p.invoice, p.event, payment],
  )
}

for (const p of (books.period ?? []).filter((p) => p.closed)) {
  await db.query('UPDATE account.period SET closed = $2 WHERE month = $1', [p.month, day(p.closed)])
}

await db.query('COMMIT')
await db.end()
console.log(
  `seed: ${members.length} members, ${positions.length} seats, ${decisions.length} decisions, ${votes} stances, ` +
    `${admissions.length} admissions, ${versions} versions, ${adoptions.length} adoptions, ${clients.length} clients, ${entries.length} entries, ${invoices.length} invoices, ` +
    `${postings.length} postings into ${db.database}`,
)
